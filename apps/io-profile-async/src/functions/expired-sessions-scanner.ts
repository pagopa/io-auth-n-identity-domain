import { AzureFunction, Context } from "@azure/functions";
import { QueueClient } from "@azure/storage-queue";
import { asyncIterableToArray } from "@pagopa/io-functions-commons/dist/src/utils/async";
import { CosmosErrors } from "@pagopa/io-functions-commons/dist/src/utils/cosmosdb_model";
import * as E from "fp-ts/Either";
import { flow, pipe } from "fp-ts/function";
import * as RA from "fp-ts/ReadonlyArray";
import * as T from "fp-ts/Task";
import * as TE from "fp-ts/TaskEither";
import * as t from "io-ts";
import {
  RetrievedSessionNotifications,
  SessionNotifications
} from "../models/session-notifications";
import {
  Dependencies as SessionENotificationsRepositoryDependencies,
  SessionNotificationsRepository
} from "../repositories/session-notifications";
import { ExpiredSessionAdvisorQueueMessage } from "../types/expired-session-advisor-queue-message";
import { Interval } from "../types/interval";
import { trackEvent } from "../utils/appinsights";
import { getSelfFromModelValidationError } from "../utils/cosmos/errors";
import { QueueTransientError } from "../utils/queue-utils";

// TODO: better dependencies refs
type Dependencies = {
  SessionNotificationsRepository: SessionNotificationsRepository;
  QueueClient: QueueClient;
} & SessionENotificationsRepositoryDependencies;

export type ItemToProcess = {
  queuePayload: ExpiredSessionAdvisorQueueMessage;
  retrivedDbItem: RetrievedSessionNotifications;
  itemTimeoutInSeconds?: number;
};

const createItemToProcess = (itemTimeoutInSeconds: number) => (
  retrivedDbItem: RetrievedSessionNotifications
): ItemToProcess => ({
  retrivedDbItem,
  queuePayload: {
    fiscalCode: retrivedDbItem.id,
    expiredAt: new Date(retrivedDbItem.expiredAt)
  },
  itemTimeoutInSeconds
});

const onBadRetrievedItem = (validationErrors: t.Errors): t.Errors => {
  const badRecordSelf = getSelfFromModelValidationError(validationErrors);

  trackEvent({
    name:
      "io.citizen-auth.prof-async.expired-sessions-scanner.permanent.bad-record",
    properties: {
      message: "Found a non compliant db record",
      badRecordSelf
    }
  });

  return validationErrors;
};

const mapItemChunck = (
  chunkNumber: number,
  chunk: ReadonlyArray<t.Validation<RetrievedSessionNotifications>>
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

const onRevertItemFlagFailure = (record: RetrievedSessionNotifications) => (
  cosmosError: CosmosErrors
): CosmosErrors => {
  trackEvent({
    name:
      "io.citizen-auth.prof-async.expired-sessions-scanner.permanent.revert-failure",
    properties: {
      message:
        "Error reverting expired session flag(EXPIRED_SESSION) after Queue write failure",
      // eslint-disable-next-line no-underscore-dangle
      itemDbSelf: record._self
    }
  });

  return cosmosError;
};

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
  record: RetrievedSessionNotifications,
  deps: Dependencies
) => (
  queueInsertError: QueueTransientError
): TE.TaskEither<QueueTransientError, undefined> =>
  pipe(
    updateExpiredSessionNotificationFlag(record, deps, false),
    TE.mapLeft(onRevertItemFlagFailure(record)),
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
    markUserAsNotified(item.retrivedDbItem, deps),
    TE.chainW(() =>
      pipe(
        sendMessage(item),
        TE.orElseW(handleQueueInsertFailure(item.retrivedDbItem, deps))
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

// TODO: inject config
export type ExpiredSessionScannerFunctionInput = {
  placeholder: string;
};

const isLastTimerTriggerRetry = (context: Context) =>
  !!context.executionContext.retryContext &&
  context.executionContext.retryContext.retryCount ===
    context.executionContext.retryContext.maxRetryCount;

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
      if (isLastTimerTriggerRetry(context)) {
        trackEvent({
          name:
            "io.citizen-auth.prof-async.expired-sessions-scanner.max-retry-reached",
          properties: {
            message: "Reached max retry for expired sessions",
            interval
          }
        });
      }
      throw error;
    })
  )();
};
