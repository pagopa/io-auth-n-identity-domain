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
import { ExpiredSessionDiscovererConfig } from "../config";
import { RetrievedSessionNotifications } from "../models/session-notifications";
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
  expiredSessionsDiscovererConf: ExpiredSessionDiscovererConfig;
} & SessionNotificationsRepositoryDependencies;

export type ItemToProcess = {
  queuePayload: ExpiredSessionAdvisorQueueMessage;
  retrievedDbItem: RetrievedSessionNotifications;
  itemTimeoutInSeconds: number;
};

const createItemToProcess = (itemTimeoutInSeconds: number) => (
  retrievedDbItem: RetrievedSessionNotifications
): ItemToProcess => ({
  retrievedDbItem,
  queuePayload: {
    fiscalCode: retrievedDbItem.id,
    expiredAt: new Date(retrievedDbItem.expiredAt)
  },
  itemTimeoutInSeconds
});

const onBadRetrievedItem = (validationErrors: t.Errors): t.Errors => {
  const badRecordSelf = getSelfFromModelValidationError(validationErrors);

  trackEvent({
    name:
      "io.citizen-auth.prof-async.expired-sessions-discoverer.permanent.bad-record",
    properties: {
      message: "Found a non compliant db record",
      badRecordSelf
    }
  });

  return validationErrors;
};

const mapItemChunk = (timeoutMultiplier: number) => (
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
      "io.citizen-auth.prof-async.expired-sessions-discoverer.permanent.revert-failure",
    properties: {
      message:
        "Error reverting expired session flag(EXPIRED_SESSION) after Queue write failure",
      // eslint-disable-next-line no-underscore-dangle
      itemDbSelf: record._self
    }
  });

  return cosmosError;
};

const handleQueueInsertFailure: (
  record: RetrievedSessionNotifications
) => (
  queueInsertError: QueueTransientError
) => RTE.ReaderTaskEither<
  TriggerDependencies,
  QueueTransientError,
  undefined
> = (record: RetrievedSessionNotifications) => (
  queueInsertError: QueueTransientError
) => (deps: TriggerDependencies) =>
  pipe(
    deps.SessionNotificationsRepository.updateExpiredSessionNotificationFlag(
      record,
      false
    )(deps),
    TE.mapLeft(onRevertItemFlagFailure(record)),
    TE.bimap(
      _ => void 0, // in case of error reverting not propagate the error, cause no retry should be triggered
      () => queueInsertError // in case the revert was accomplished with succes, forward the queueInsert error
    ),
    TE.swap
  );

const sendMessage = (
  item: ItemToProcess
): RTE.ReaderTaskEither<TriggerDependencies, QueueTransientError, void> =>
  RTE.left(new QueueTransientError("Error Simulated Queue")); // TODO: replace with actual implementation

export const processItem: (
  item: ItemToProcess
) => RTE.ReaderTaskEither<
  TriggerDependencies,
  QueueTransientError,
  void
> = item => deps =>
  pipe(
    deps.SessionNotificationsRepository.updateExpiredSessionNotificationFlag(
      item.retrievedDbItem,
      true
    ),
    RTE.mapLeft(
      e =>
        new QueueTransientError(
          `Error updating expired session flag(EXPIRED_SESSION): ${e.kind}`
        )
    ),
    RTE.chainW(() =>
      pipe(
        sendMessage(item),
        RTE.orElseW(handleQueueInsertFailure(item.retrievedDbItem))
      )
    )
  )(deps);

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

export const retrieveFromDbInChunks: (
  interval: Interval
) => RTE.ReaderTaskEither<
  TriggerDependencies,
  QueueTransientError,
  ReadonlyArray<ReadonlyArray<ItemToProcess>>
> = (interval: Interval) => (deps: TriggerDependencies) =>
  pipe(
    SessionNotificationsRepository.findByExpiredAtAsyncIterable(
      interval,
      deps.expiredSessionsDiscovererConf.EXPIRED_SESSION_SCANNER_CHUNK_SIZE
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
        mapItemChunk(
          deps.expiredSessionsDiscovererConf
            .EXPIRED_SESSION_SCANNER_TIMEOUT_MULTIPLIER
        )
      )
    )
  );

export const ExpiredSessionsDiscovererFunction = (
  deps: TriggerDependencies
): AzureFunction => async (
  context: Context,
  _timer: unknown
): Promise<void> => {
  const interval = createInterval();
  return pipe(
    retrieveFromDbInChunks(interval),
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
        // TODO: replace with a customEvent which includes the TransientError number
        //TODO: Create a new error type, TransientError instead using the QueueTrigger specific ones
        context.log.error(
          `Multiple transient errors occurred during execution: count=${errors.length}`
        );
      } else if (errors instanceof QueueTransientError) {
        context.log.error(`Transient error occurred: ${errors.message}`);
      }

      if (isLastTimerTriggerRetry(context)) {
        trackEvent({
          name:
            "io.citizen-auth.prof-async.expired-sessions-discoverer.max-retry-reached",
          properties: {
            message: "Reached max retry for expired sessions",
            interval
          }
        });
      }
      throw new Error("One or more chunks failed during processing");
    })
  )(deps)();
};
