import { AzureFunction, Context } from "@azure/functions";
import { QueueClient } from "@azure/storage-queue";
import { asyncIterableToArray } from "@pagopa/io-functions-commons/dist/src/utils/async";
import { CosmosErrors } from "@pagopa/io-functions-commons/dist/src/utils/cosmosdb_model";
import * as E from "fp-ts/Either";
import { flow, pipe } from "fp-ts/function";
import * as RTE from "fp-ts/ReaderTaskEither";
import * as RA from "fp-ts/ReadonlyArray";
import * as T from "fp-ts/Task";
import * as TE from "fp-ts/TaskEither";
import * as t from "io-ts";
import { ExpiredSessionScannerConfig } from "../config";
import {
  RetrievedSessionNotifications,
  SessionNotifications
} from "../models/session-notifications";
import {
  SessionNotificationsRepository,
  Dependencies as SessionNotificationsRepositoryDependencies
} from "../repositories/session-notifications";
import { ExpiredSessionAdvisorQueueMessage } from "../types/expired-session-advisor-queue-message";
import { createInterval, Interval } from "../types/interval";
import { trackEvent } from "../utils/appinsights";
import { getSelfFromModelValidationError } from "../utils/cosmos/errors";
import { isLastTimerTriggerRetry } from "../utils/function-utils";
import { QueueTransientError } from "../utils/queue-utils";

type TriggerDependencies = {
  SessionNotificationsRepository: SessionNotificationsRepository;
  QueueClient: QueueClient;
  expiredSessionsScannerConf: ExpiredSessionScannerConfig;
} & SessionNotificationsRepositoryDependencies;

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

const mapItemChunck = (timeoutMultiplier: number) => (
  chunkNumber: number,
  chunk: ReadonlyArray<t.Validation<RetrievedSessionNotifications>>
): ReadonlyArray<ItemToProcess> =>
  pipe(
    chunk,
    RA.map(
      flow(
        E.bimap(
          onBadRetrievedItem,
          createItemToProcess(timeoutMultiplier * chunkNumber)
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

const updateExpiredSessionNotificationFlag: (
  record: SessionNotifications,
  flagNewValue: boolean
) => RTE.ReaderTaskEither<TriggerDependencies, CosmosErrors, void> = (
  record: SessionNotifications,
  flagNewValue: boolean
) => (deps: TriggerDependencies) =>
  pipe(
    deps.SessionNotificationsRepository.updateNotificationEvents(
      record.id,
      record.expiredAt,
      {
        ...record.notificationEvents,
        EXPIRED_SESSION: flagNewValue
      }
    )(deps),
    TE.map(() => void 0)
  );

const handleQueueInsertFailure = (record: RetrievedSessionNotifications) => (
  queueInsertError: QueueTransientError
): RTE.ReaderTaskEither<TriggerDependencies, QueueTransientError, undefined> =>
  pipe(
    updateExpiredSessionNotificationFlag(record, false),
    RTE.mapLeft(onRevertItemFlagFailure(record)),
    RTE.bimap(
      _ => void 0, // in case of error reverting not propagate the error, cause no retry should be triggered
      () => queueInsertError // in case the revert was accomplished with succes, forward the queueInsert error
    ),
    RTE.swap
  );

const sendMessage = (
  item: ItemToProcess
): RTE.ReaderTaskEither<TriggerDependencies, QueueTransientError, void> =>
  RTE.of(void 0); // TODO: replace with actual implementation

const markUserAsNotified = (
  record: SessionNotifications
): RTE.ReaderTaskEither<TriggerDependencies, QueueTransientError, void> =>
  pipe(
    updateExpiredSessionNotificationFlag(record, true),
    RTE.mapLeft(
      e => new QueueTransientError(`Error processing item: ${e.kind}`)
    )
  );

export const processItem = (
  item: ItemToProcess
): RTE.ReaderTaskEither<TriggerDependencies, QueueTransientError, void> =>
  pipe(
    markUserAsNotified(item.retrivedDbItem),
    RTE.chainW(() =>
      pipe(
        sendMessage(item),
        RTE.orElseW(handleQueueInsertFailure(item.retrivedDbItem))
      )
    )
  );

export const processChunk = (
  chunk: ReadonlyArray<ItemToProcess>
): RTE.ReaderTaskEither<
  TriggerDependencies,
  ReadonlyArray<QueueTransientError>,
  void
> =>
  pipe(
    chunk,
    RA.map(
      flow(
        processItem,
        RTE.mapLeft(error => [error])
      )
    ),
    RA.sequence(
      RTE.getApplicativeReaderTaskValidation(
        T.ApplicativePar,
        RA.getSemigroup<QueueTransientError>()
      )
    ),
    RTE.map(() => void 0)
  );

export const retrieveFromDbInChuncks: (
  interval: Interval
) => RTE.ReaderTaskEither<
  TriggerDependencies,
  QueueTransientError,
  ReadonlyArray<ReadonlyArray<ItemToProcess>>
> = (interval: Interval) => (deps: TriggerDependencies) =>
  pipe(
    SessionNotificationsRepository.findByExpiredAtAsyncIterable(
      interval,
      deps.expiredSessionsScannerConf.EXPIRED_SESSION_SCANNER_CHUNCK_SIZE
    )(deps),
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
    TE.map(
      RA.mapWithIndex(
        mapItemChunck(
          deps.expiredSessionsScannerConf
            .EXPIRED_SESSION_SCANNER_TIMEOUT_MULTIPLIER
        )
      )
    )
  );

export const ExpiredSessionsScannerFunction = (
  deps: TriggerDependencies
): AzureFunction => async (
  context: Context,
  _timer: unknown
): Promise<void> => {
  const interval = createInterval();
  return pipe(
    retrieveFromDbInChuncks(interval),
    RTE.chainW(
      flow(
        RA.map(
          flow(
            processChunk,
            RTE.mapLeft(error => [error])
          )
        ),
        RA.sequence(
          RTE.getApplicativeReaderTaskValidation(
            T.ApplicativeSeq,
            RA.getSemigroup<ReadonlyArray<QueueTransientError>>()
          )
        ),
        RTE.map(() => void 0),
        RTE.mapLeft(RA.flatten)
      )
    ),
    RTE.getOrElse(errors => {
      if (Array.isArray(errors)) {
        // TODO: maybe a customEvent is better than logging each errors, just for logging purpose and not alert and so on.
        // an alternative is not logging at all on TransientErorrs
        context.log.error(
          `Multiple transient errors occurred during execution: count=${errors.length}`
        );
        errors.forEach(e => context.log.error(` - ${e.message}`));
      } else if (errors instanceof QueueTransientError) {
        context.log.error(`Transient error occurred: ${errors.message}`);
      }

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
      throw new QueueTransientError(
        "One or more chunks failed during processing"
      );
    })
  )(deps)();
};
