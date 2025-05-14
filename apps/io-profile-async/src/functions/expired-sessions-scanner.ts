import { AzureFunction, Context } from "@azure/functions";
import { Either } from "fp-ts/lib/Either";
import { pipe } from "fp-ts/function";
import * as A from "fp-ts/Array";
import * as E from "fp-ts/Either";
import * as O from "fp-ts/Option";
import * as RA from "fp-ts/ReadonlyArray";
import * as RTE from "fp-ts/ReaderTaskEither";
import * as TE from "fp-ts/TaskEither";
import { FiscalCode, NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { QueueClient } from "@azure/storage-queue";
import { error } from "@pagopa/logger";
import { right } from "fp-ts/lib/EitherT";
import * as AI from "../utils/async-iterable-task";
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

type FunctionDependencies = {
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
  expiredSessionStatus: boolean
) => (deps: FunctionDependencies): TE.TaskEither<Error, SessionExpiration> =>
  // TODO: debounce on 429
  pipe(
    deps.SessionExpirationRepository.updateNotificationEvents(fiscalCode, {
      EXPIRING_SESSION: expiredSessionStatus // TODO: Change to EXPIRED_SESSION (using EXPIRING_SESSION for testing purposes based on the current query)
    })(deps),
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
  deps: FunctionDependencies
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
 * Function to handle session expiration.
 * It updates the notification events and inserts a message into the queue.
 *
 * @param sessionExpiration - The session expiration object
 * @param deps - The dependencies for the function
 * @returns A TaskEither that resolves to a fiscal code or an error
 */
const handleSessionExpiration = (
  sessionExpiration: SessionExpiration,
  deps: FunctionDependencies
): TE.TaskEither<PermanentError | TransientError, FiscalCode | string> => {
  const fiscalCode = sessionExpiration.id;
  const expiredSessionAdvisorQueueMessage: ExpiredSessionAdvisorQueueMessage = {
    fiscalCode: fiscalCode as FiscalCode,
    expiredAt: sessionExpiration.expirationDate
  };

  const handleError = (error: string) =>
    new TransientError(`Error during process [processPage]: ${error}`);

  return pipe(
    updateNotificationEvents(fiscalCode, true)(deps),
    TE.mapLeft(error => handleError(`Updating notification events: ${error}`)),
    TE.chain(() => insertIntoQueue(expiredSessionAdvisorQueueMessage)(deps)),
    TE.map(() => fiscalCode),
    TE.mapLeft(error => handleError(`Inserting into queue: ${error}`))
  );
};

/**
 * Function to handle session expirations.
 * It processes each session expiration and returns an array of fiscal codes.
 *
 * @param page - The array of session expiration objects
 * @param deps - The dependencies for the function
 * @returns A TaskEither that resolves to an array of fiscal codes or an error
 */
const handleSessionExpirations = (
  page: ReadonlyArray<E.Either<unknown, SessionExpiration>>
) => (
  deps: FunctionDependencies
): TE.TaskEither<
  PermanentError | TransientError,
  TE.TaskEither<Error, ReadonlyArray<FiscalCode | string>>
> =>
  TE.right(
    pipe(
      page,
      RA.rights,
      RA.map(sessionExpiration =>
        handleSessionExpiration(sessionExpiration, deps)
      ),
      TE.sequenceArray
    )
  );

/**
 * Function to process session expirations
 *
 * @param interval - The interval to filter session expirations
 * @returns A ReaderTaskEither that resolves to an array of fiscal codes or an error
 */
export const processExpirations: (
  interval: Interval
) => RTE.ReaderTaskEither<
  FunctionDependencies,
  Error,
  ReadonlyArray<FiscalCode | string> | any
> = (interval: Interval) => ({ SessionExpirationRepository, ...deps }) =>
  pipe(
    SessionExpirationRepository.findByExpirationDateAsyncIterable(interval)(
      deps
    ),
    TE.map(AI.fromAsyncIterable),
    TE.map(AI.map(handleSessionExpirations)),
    TE.mapLeft(_ => new Error("An error occurred during processing."))
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
  deps: FunctionDependencies
): AzureFunction => async (context: Context, _timer: unknown) => {
  await pipe(
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
};
