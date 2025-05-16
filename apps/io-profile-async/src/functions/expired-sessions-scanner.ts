import { AzureFunction, Context } from "@azure/functions";
import { QueueClient } from "@azure/storage-queue";
import { asyncIterableToArray } from "@pagopa/io-functions-commons/dist/src/utils/async";
import { CosmosErrors } from "@pagopa/io-functions-commons/dist/src/utils/cosmosdb_model";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import * as E from "fp-ts/Either";
import { flow, identity, pipe } from "fp-ts/function";
import * as O from "fp-ts/lib/Option";
import * as RA from "fp-ts/ReadonlyArray";
import * as T from "fp-ts/Task";
import * as TE from "fp-ts/TaskEither";
import * as t from "io-ts";
import { SessionNotifications } from "../models/session-notifications";
import { Tracker, TrackerRepositoryDependency } from "../repositories";
import {
  Dependencies as SessionENotificationsRepositoryDependencies,
  SessionNotificationsRepository
} from "../repositories/session-notifications";
import { ExpiredSessionAdvisorQueueMessage } from "../types/expired-session-advisor-queue-message";
import { Interval } from "../types/interval";
import { QueueTransientError } from "../utils/queue-utils";

type Dependencies = {
  SessionNotificationsRepository: SessionNotificationsRepository;
  TrackerRepository: Tracker;
  QueueClient: QueueClient;
} & SessionENotificationsRepositoryDependencies &
  TrackerRepositoryDependency;

export type ItemToProcess = {
  queuePayload: ExpiredSessionAdvisorQueueMessage;
  originalItem: SessionNotifications;
  itemTimeoutInSeconds?: number;
};

const createItemToProcess = (itemTimeoutInSeconds: number) => (
  originalItem: SessionNotifications
): ItemToProcess => ({
  originalItem,
  queuePayload: {
    fiscalCode: originalItem.id,
    expiredAt: new Date(originalItem.expiredAt)
  },
  itemTimeoutInSeconds
});

const onBadRetrievedItem = (e: t.Errors): t.Errors => {
  // ritrovo _self dell' oggetto che ha fallito la validazione in modo da poterlo loggare in un trackEvent
  // TODO: migliorare con oggetto base di cosmos
  const originalItem = pipe(
    O.tryCatch(() => e[0].context[0].actual),
    O.chain(actual =>
      typeof actual === "object" && actual !== null && "_self" in actual
        ? O.fromNullable((actual as { _self?: string })["_self"])
        : O.none
    ),
    O.fold(() => "N/A", identity)
  );
  // TODO: rimpiazzare con un trackEvent
  console.error("BAD ITEM RETRIEVED SKIPPING IT:", originalItem);
  return e;
};

const mapItemChunck = (
  chunkNumber: number,
  chunk: ReadonlyArray<t.Validation<SessionNotifications>>
): ReadonlyArray<ItemToProcess> =>
  pipe(
    chunk,
    RA.map(
      flow(
        E.bimap(
          onBadRetrievedItem,
          createItemToProcess(7 * chunkNumber) //TODO: put in configuration the baseTimeout
        )
      )
    ),
    RA.rights // Filter out the left values, which are already notified
  );

const onRevertItemFlagFailure = (record: SessionNotifications) => (
  cosmosError: CosmosErrors
): TE.TaskEither<CosmosErrors, void> =>
  pipe(
    //TODO: here trackEvents, console.log is a placeholder
    console.error(
      `FATAL ERROR REVERTING ITEM FLAG for user having fiscalCode ${record.id}`,
      cosmosError
    ),
    TE.of,
    TE.chain(() => TE.left(cosmosError))
  );

const updateExpiredSessionNotificationFlag = (
  record: SessionNotifications,
  deps: Dependencies,
  flagNewValue: boolean
): TE.TaskEither<CosmosErrors, void> =>
  pipe(
    deps.SessionNotificationsRepository.updateNotificationEvents(
      record.id,
      record.expiredAt,
      {
        ...record.notificationEvents,
        EXPIRED_SESSION: flagNewValue
      }
    )(deps),
    TE.map(_ => void 0)
  );

const handleQueueInsertFailure = (
  record: SessionNotifications,
  deps: Dependencies
) => (
  queueInsertError: QueueTransientError
): TE.TaskEither<QueueTransientError, undefined> =>
  pipe(
    updateExpiredSessionNotificationFlag(record, deps, false),
    TE.map(() => void 0),
    TE.orElse(onRevertItemFlagFailure(record)),
    TE.bimap(
      _ => void 0, // in case of error reverting not propagate the error, cause no retry should be triggered
      () => queueInsertError // in case the revert was accomplished with succes, forward the queueInsert error
    ),
    TE.swap
  );

// TODO: placeholder function
// replace with the implemented one
const sendMessage: (
  item: ItemToProcess
) => TE.TaskEither<QueueTransientError, void> = item => pipe(TE.of(void 0));

const markUserAsNotified = (
  record: SessionNotifications,
  deps: Dependencies
): TE.TaskEither<QueueTransientError, void> =>
  pipe(
    updateExpiredSessionNotificationFlag(record, deps, true),
    TE.map(_ => void 0),
    TE.mapLeft(e => new QueueTransientError(`Error processing item: ${e.kind}`))
  );

export const processItem = (deps: Dependencies) => (
  item: ItemToProcess
): TE.TaskEither<QueueTransientError, void> =>
  pipe(
    markUserAsNotified(item.originalItem, deps),
    TE.chainW(() =>
      pipe(
        sendMessage(item),
        TE.orElseW(handleQueueInsertFailure(item.originalItem, deps))
      )
    )
  );

export const processChunk = (deps: Dependencies) => (
  chunk: ReadonlyArray<ItemToProcess>
): TE.TaskEither<QueueTransientError, void> =>
  pipe(
    chunk,
    RA.map(
      flow(
        processItem(deps),
        TE.mapLeft(error => [error])
      )
    ),
    RA.sequence(
      TE.getApplicativeTaskValidation(
        T.ApplicativePar,
        RA.getSemigroup<QueueTransientError>()
      )
    ),
    TE.map(() => void 0),
    TE.mapLeft(errors => {
      errors.forEach(e =>
        console.error(`Error processing chunck item: ${e.message}`)
      ); // TODO: log errors occours in chunck process using RA
      return new QueueTransientError(
        "One or more error happen in chunck processing"
      );
    })
  );

export const retrieveFromDbInChuncks = (deps: Dependencies) => (
  interval: Interval
): TE.TaskEither<
  QueueTransientError,
  ReadonlyArray<ReadonlyArray<ItemToProcess>>
> =>
  pipe(
    SessionNotificationsRepository.findByExpiredAtAsyncIterable(interval)(deps),
    TE.of,
    TE.chainW(
      flow(asyncIterableToArray, asyncIterator =>
        TE.tryCatch(
          () => asyncIterator,
          _ =>
            new QueueTransientError(
              "Error retrieving session expirations, AsyncIterable fetch execution failure"
            )
        )
      )
    ),
    TE.map(RA.mapWithIndex(mapItemChunck))
  );

// TODO: mocked method
const calculateTimeInterval = (): Interval => ({
  from: new Date("2025-05-17T00:00:00.000Z"),
  to: new Date("2025-05-17T23:59:59.999Z")
});

// inject config
export type ExpiredSessionScannerFunctionInput = {
  placeholder: string;
};

export const ExpiredSessionsScannerFunction = (
  deps: Dependencies
): AzureFunction => async (
  context: Context,
  _timer: unknown
): Promise<void> => {
  const interval = calculateTimeInterval(); // TODO: replace with the dynamic one trying putting in pipe all the way down in order to add toCustomEvent
  return pipe(
    interval,
    retrieveFromDbInChuncks(deps),
    TE.chain(
      flow(
        RA.map(processChunk(deps)),
        RA.sequence(T.ApplicativeSeq),
        T.chain(
          flow(
            RA.sequence(E.Applicative), // check chunck process results, if any in error(QueueTransientError), propagate in order to retry
            TE.fromEither,
            TE.map(_ => void 0)
          )
        )
      )
    ),
    TE.getOrElse(error => {
      context.log.error(
        `(Retry number: ${context.executionContext.retryContext?.retryCount ??
          "undefined"}) Error processing expired sessions: ${error.message}`
      );
      if (
        context.executionContext.retryContext?.retryCount ===
        context.executionContext.retryContext?.maxRetryCount
      ) {
        // TODO: add from and to
        deps.TrackerRepository.trackEvent(
          "io.citizen-auth.prof-async.error.permanent" as NonEmptyString,
          "Reached max retry for expired sessions" as NonEmptyString,
          false,
          { interval }
        );
      }
      throw error;
    })
  )();
};
