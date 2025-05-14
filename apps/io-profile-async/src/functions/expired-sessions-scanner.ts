import { AzureFunction, Context } from "@azure/functions";
import { flow, pipe } from "fp-ts/function";
import * as E from "fp-ts/Either";
import * as RA from "fp-ts/ReadonlyArray";
import * as RTE from "fp-ts/ReaderTaskEither";
import * as T from "fp-ts/Task";
import * as TE from "fp-ts/TaskEither";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { QueueClient } from "@azure/storage-queue";
import * as AI from "@pagopa/io-functions-commons/dist/src/utils/async_iterable_task";
import {
  SessionExpirationRepository,
  Dependencies as SessionExpirationRepositoryDependencies
} from "../repositories/session-expiration";
import { Interval } from "../types/interval";
import { SessionExpiration } from "../models/session-expiration-model";
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

// TODO: move to a common file
export class TransientError extends Error {
  constructor(message?: string, error?: Error) {
    super(message, error);
    this.name = "TransientError";
  }
}

// TODO: move to a common file
export class PermanentError extends Error {
  constructor(message?: string, error?: Error) {
    super(message, error);
    this.name = "PermanentError";
  }
}

type Dependencies = {
  SessionExpirationRepository: SessionExpirationRepository;
  TrackerRepository: Tracker;
  QueueClient: QueueClient;
} & SessionExpirationRepositoryDependencies &
  TrackerRepositoryDependency;

/**
 * Function to update the notification event `EXPIRED_SESSION` for a given fiscal code
 * in the SessionExpirationRepository.
 *
 * @param fiscalCode - The fiscal code of the user
 * @returns A TaskEither that resolves to a SessionExpiration or an error
 */
const updateNotificationEvents = (
  fiscalCode: string,
  expirationDate: number,
  expiredSessionStatus: boolean
) => (deps: Dependencies): TE.TaskEither<Error, SessionExpiration> =>
  pipe(
    deps.SessionExpirationRepository.updateNotificationEvents(
      fiscalCode,
      expirationDate,
      {
        EXPIRED_SESSION: expiredSessionStatus
      }
    )(deps),
    TE.mapLeft(
      err =>
        new TransientError(
          `Error while updating notification events status: ${cosmosErrorsToString(
            err
          )}`
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
    TE.map(() => true),
    TE.mapLeft(
      error =>
        new QueueTransientError(
          `Error while inserting in queue ${JSON.stringify(payload)}: ${error}`
        )
    )
  );

/**
 * Function to handle session expirations.
 * It processes each session expiration and returns an array of fiscal codes.
 *
 * @param page - The array of session expiration objects
 * @param deps - The dependencies for the function
 * @returns A TaskEither that resolves to an array of fiscal codes or an error
 * : TE.TaskEither<Error, void>
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
 * Function to handle session expiration.
 * It updates the notification events and inserts a message into the queue.
 *
 * @param sessionExpiration - The session expiration object
 * @param deps - The dependencies for the function
 * @returns A TaskEither that resolves to a fiscal code or an error
 */
const handleSessionExpiration = (
  record: SessionExpiration,
  { sessionExpirationModel, ...deps }: Dependencies,
  retryAttempsLeft = 5
): TE.TaskEither<Error, void> =>
  pipe(
    sessionExpirationModel.patch([record.id, record.expirationDate], {
      notificationEvents: {
        ...record.notificationEvents,
        EXPIRED_SESSION: true
      }
    }),
    TE.orElseW(e => {
      if (retryAttempsLeft === 0) {
        return TE.left(
          new Error(`Error updating session expiration: ${e.kind}`)
        );
      } else {
        logger.error(
          `Error updating session expiration: ${e.kind}, retrying... Attempts left: ${retryAttempsLeft} FiscalCode: ${record.id}`
        );
        return pipe(
          TE.fromTask(T.delay(500)(T.of(undefined))),
          TE.chain(() =>
            handleSessionExpiration(
              record,
              { sessionExpirationModel, ...deps },
              retryAttempsLeft - 1
            )
          )
        );
      }
    }),
    TE.map(_ => void 0)
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
        } else {
          context.log.error(
            `(Retry number: ${context.executionContext.retryContext
              ?.retryCount ??
              "undefined"}) Error processing expired sessions on run number : ${
              error.message
            }`
          );
          throw error;
        }
      },
      () => context.log("Expired sessions scan completed.")
    )
  )();
