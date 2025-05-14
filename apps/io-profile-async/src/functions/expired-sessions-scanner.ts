import { AzureFunction, Context } from "@azure/functions";
import { flow, not, pipe } from "fp-ts/function";
import * as E from "fp-ts/Either";
import * as RA from "fp-ts/ReadonlyArray";
import * as RTE from "fp-ts/ReaderTaskEither";
import * as TE from "fp-ts/TaskEither";
import { FiscalCode, NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { QueueClient } from "@azure/storage-queue";
import * as AI from "@pagopa/io-functions-commons/dist/src/utils/async_iterable_task";
import {
  SessionExpirationRepository,
  Dependencies as SessionExpirationRepositoryDependencies
} from "../repositories/session-expiration";
import { Interval } from "../types/interval";
import {
  NotificationEvents,
  SessionExpiration
} from "../models/session-expiration-model";
import { QueuePermanentError, QueueTransientError } from "../utils/queue-utils";
import { Tracker, TrackerRepositoryDependency } from "../repositories";
import * as QueueUtils from "../utils/queue-utils";
import { ExpiredSessionAdvisorQueueMessage } from "../types/expired-session-advisor-queue-message";
import { cosmosErrorsToString } from "../utils/cosmos/errors";

const logger = {
  info: (message: string) =>
    console.log(
      `[INFO][TEST USER ENGAGEMENT QUERY ITERATOR][${new Date().toISOString()}] => ${message}`
    ),
  error: (message: string, additionalData?: unknown) =>
    additionalData
      ? console.error(
          `[ERROR][TEST USER ENGAGEMENT QUERY ITERATOR][${new Date().toISOString()}] => ${message}`,
          additionalData
        )
      : console.error(
          `[ERROR][TEST USER ENGAGEMENT QUERY ITERATOR][${new Date().toISOString()}] => ${message}`
        )
};

type Dependencies = {
  SessionExpirationRepository: SessionExpirationRepository;
  TrackerRepository: Tracker;
  QueueClient: QueueClient;
} & SessionExpirationRepositoryDependencies &
  TrackerRepositoryDependency;

/**
 * Function to update the notification events status for a given fiscal code
 * in the SessionExpirationRepository.
 *
 * @param fiscalCode - The fiscal code of the user
 * @param expirationDate - The expiration date of the session
 * @param notificationStatus - The status of the notification events
 * @param maxRetry - The maximum number of retries for the operation
 * @returns A TaskEither that resolves to a SessionExpiration or an error
 */
const updateNotificationEvents = (
  fiscalCode: string,
  expirationDate: number,
  notificationStatus: NotificationEvents,
  maxRetry?: number
) => (
  deps: Dependencies
): TE.TaskEither<QueueTransientError, SessionExpiration> =>
  pipe(
    deps.SessionExpirationRepository.updateNotificationEventsWithRetry(
      fiscalCode,
      expirationDate,
      notificationStatus,
      maxRetry
    )(deps),
    x => {
      logger.info(`Notification Status: ${JSON.stringify(notificationStatus)}`);
      return x;
    },
    TE.mapLeft(
      error =>
        new QueueTransientError(
          `Error updating notification events: ${cosmosErrorsToString(error)}`
        )
    )
  );

/**
 * Function to insert an item into the queue
 *
 * @param payload - The message to be inserted into the queue
 * @returns A TaskEither that resolves to a boolean indicating success or failure
 */
const insertIntoQueue = (payload: ExpiredSessionAdvisorQueueMessage) => (
  deps: Dependencies
): TE.TaskEither<QueueTransientError, boolean> =>
  pipe(
    QueueUtils.insertItemIntoQueue({
      client: deps.QueueClient,
      appInsightsTelemetryClient: deps.telemetryClient,
      item: { payload } // TODO: check `itemTimeoutInSeconds`
    }),
    TE.mapLeft(
      error =>
        new QueueTransientError(
          `Error while inserting in queue ${JSON.stringify(payload)}: ${error}`
        )
    )
  );

/**
 * Function to handle session expiration.
 * It updates the notification events and inserts a message into the queue.
 *
 * @param sessionExpiration - The session expiration object
 * @param deps - The dependencies for the function
 * @returns A TaskEither that resolves to a boolean or an error
 */
const handleSessionExpiration = (
  record: SessionExpiration,
  { sessionExpirationModel, ...deps }: Dependencies
): TE.TaskEither<Error, boolean> =>
  pipe(
    // Update the notification events for the session expiration
    updateNotificationEvents(record.id, record.expirationDate, {
      EXPIRED_SESSION: true
    })({ sessionExpirationModel, ...deps }),
    TE.mapLeft(error => {
      logger.error(`Error setting notified: ${error}`);
      return new QueueTransientError(
        `Error updating notification events: ${error}`
      );
    }),

    TE.chain(() =>
      pipe(
        // Insert the session expiration into the queue
        insertIntoQueue({
          fiscalCode: record.id as FiscalCode,
          expiredAt: new Date(record.expirationDate)
        })({ sessionExpirationModel, ...deps }),
        // If the queue insertion fails, revert the notification event update
        TE.orElse(error =>
          pipe(
            // Revert the notification event update
            updateNotificationEvents(record.id, record.expirationDate, {
              EXPIRED_SESSION: false
            })({ sessionExpirationModel, ...deps }),
            TE.orElse(error => {
              logger.error(
                `Error reverting notification events: ${error} for ${record.id}`
              );
              return TE.left(error);
            }),
            TE.chain(() => TE.left(error))
          )
        )
      )
    )
  );

/**
 * Function to handle session expirations.
 *
 * @param page - The array of session expiration objects
 * @param deps - The dependencies for the function
 * @returns A TaskEither that resolves to a number of success or an error
 * : TE.TaskEither<Error, number>
 */
const handleSessionExpirations = (
  page: ReadonlyArray<E.Either<unknown, SessionExpiration>>
) => (deps: Dependencies): TE.TaskEither<Error, number> =>
  pipe(
    page,
    RA.rights,
    RA.traverse(TE.ApplicativePar)(item => handleSessionExpiration(item, deps)),
    TE.map(processedElements => {
      logger.info(`PROCESSED ${processedElements.length} ELEMENTS`);
      return processedElements.length;
    }),
    TE.mapLeft(e => {
      logger.error("CHUNK FAILURE:", e);
      return e;
    })
  );

/**
 * Function to process session expirations
 *
 * @param interval - The interval to filter session expirations
 * @returns A ReaderTaskEither that resolves to an array of fiscal codes or an error
 */
export const processExpirations: (
  interval: Interval
) => RTE.ReaderTaskEither<Dependencies, Error, ReadonlyArray<number>> = (
  interval: Interval
) => ({ SessionExpirationRepository, ...deps }) =>
  pipe(
    SessionExpirationRepository.findByExpirationDateAsyncIterable(interval)(
      deps
    ),
    TE.chainW(
      flow(
        AI.fromAsyncIterable,
        AI.map(page =>
          pipe(
            handleSessionExpirations(page)({
              SessionExpirationRepository,
              ...deps
            })
          )
        ),
        AI.foldTaskEither(E.toError),
        TE.chainW(tasks => pipe(tasks, RA.sequence(TE.ApplicativeSeq)))
      )
    )
  );

/**
 * Function to scan for expired sessions.
 * This function is triggered by a timer and processes expired sessions.
 * In case of a permanent error, it tracks the event using the TrackerRepository.
 * In case of a transient error, it will retry the operation by throwing the error.
 *
 * @param deps - The dependencies for the function
 * @returns An AzureFunction that processes expired sessions
 */
export const ExpiredSessionsScannerFunction = (
  deps: Dependencies
): AzureFunction => async (context: Context, _timer: unknown) =>
  pipe(
    processExpirations({
      from: new Date(1746992583924),
      to: new Date(1746992883924)
    })(deps),
    TE.match(
      error => {
        if (error instanceof QueuePermanentError) {
          deps.TrackerRepository.trackEvent(
            "io.citizen-auth.prof-async.error.permanent" as NonEmptyString,
            (error.message ??
              "Expired Sessions Scanner Error") as NonEmptyString
          )(deps);
          return;
        }

        context.log.error(
          `(Retry number: ${context.executionContext.retryContext?.retryCount ??
            "undefined"}) Error processing expired sessions: ${error.message}`
        );
        throw error;
      },
      () => context.log("Expired sessions scan completed.")
    )
  )();
