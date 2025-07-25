import { AzureFunction, Context } from "@azure/functions";
import { asyncIterableToArray } from "@pagopa/io-functions-commons/dist/src/utils/async";
import { CosmosErrors } from "@pagopa/io-functions-commons/dist/src/utils/cosmosdb_model";
import * as E from "fp-ts/Either";
import { flow, pipe } from "fp-ts/function";
import * as O from "fp-ts/Option";
import * as RTE from "fp-ts/ReaderTaskEither";
import * as RA from "fp-ts/ReadonlyArray";
import * as T from "fp-ts/Task";
import * as TE from "fp-ts/TaskEither";
import * as t from "io-ts";
import { ExpiredSessionDiscovererConfig } from "../config";
import {
  ExpiredUserSessionsQueueRepository,
  ExpiredUserSessionsQueueRepositoryDeps
} from "../repositories/expired-user-sessions-queue";
import {
  SessionNotificationsRepository,
  Dependencies as SessionNotificationsRepositoryDependencies
} from "../repositories/session-notifications";
import { ExpiredSessionAdvisorQueueMessage } from "../types/expired-session-advisor-queue-message";
import { createInterval, Interval } from "../types/interval";
import { RetrievedSessionNotificationsStrict } from "../types/session-notification-strict";
import { trackEvent, trackException } from "../utils/appinsights";
import { getSelfFromModelValidationError } from "../utils/cosmos/errors";
import { TransientError } from "../utils/errors";
import { isLastTimerTriggerRetry } from "../utils/function-utils";

type TriggerDependencies = {
  SessionNotificationsRepo: SessionNotificationsRepository;
  expiredSessionsDiscovererConf: ExpiredSessionDiscovererConfig;
  ExpiredUserSessionsQueueRepo: ExpiredUserSessionsQueueRepository;
} & SessionNotificationsRepositoryDependencies &
  ExpiredUserSessionsQueueRepositoryDeps;

export type ItemToProcess = {
  queuePayload: ExpiredSessionAdvisorQueueMessage;
  retrievedDbItem: RetrievedSessionNotificationsStrict;
  itemTimeoutInSeconds: number;
};

const createItemToProcess = (itemTimeoutInSeconds: number) => (
  retrievedDbItem: RetrievedSessionNotificationsStrict
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
    },
    tagOverrides: {
      samplingEnabled: "false"
    }
  });

  return validationErrors;
};

const mapItemChunk = (timeoutMultiplier: number) => (
  chunkNumber: number,
  chunk: ReadonlyArray<t.Validation<RetrievedSessionNotificationsStrict>>
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
    RA.rights // Filter out the left values, malformed elements, as they cannot be processed, these were previously notified in a customEvent(onBadRetrievedItem function)
  );

const onRevertItemFlagFailure = (itemDbSelf: string) => (
  cosmosError: CosmosErrors
): CosmosErrors => {
  trackEvent({
    name:
      "io.citizen-auth.prof-async.expired-sessions-discoverer.permanent.revert-failure",
    properties: {
      message:
        "Error reverting expired session flag(EXPIRED_SESSION) after Queue write failure",
      itemDbSelf
    },
    tagOverrides: {
      samplingEnabled: "false"
    }
  });

  return cosmosError;
};

const handleQueueInsertFailure: (
  record: RetrievedSessionNotificationsStrict
) => (
  queueInsertError: TransientError
) => RTE.ReaderTaskEither<TriggerDependencies, TransientError, undefined> = ({
  id,
  expiredAt,
  _self
}: RetrievedSessionNotificationsStrict) => (
  queueInsertError: TransientError
) => (deps: TriggerDependencies) =>
  pipe(
    deps.SessionNotificationsRepo.updateExpiredSessionNotificationFlag(
      id,
      expiredAt,
      false
    )(deps),
    TE.mapLeft(onRevertItemFlagFailure(_self)),
    TE.bimap(
      _ => void 0, // in case of error reverting not propagate the error, cause no retry should be triggered
      () => queueInsertError // in case the revert was accomplished with succes, forward the queueInsert error
    ),
    TE.swap
  );

const sendMessage: (
  itemTimeoutInSeconds: number,
  queuePayload: ExpiredSessionAdvisorQueueMessage
) => RTE.ReaderTaskEither<TriggerDependencies, TransientError, void> = (
  itemTimeoutInSeconds,
  queuePayload
) => deps =>
  pipe(
    deps.ExpiredUserSessionsQueueRepo.sendExpiredUserSession(
      queuePayload,
      itemTimeoutInSeconds
    )(deps),
    TE.mapLeft(
      e =>
        new TransientError(
          "An error has occurred while sending message in queue",
          e
        )
    ),
    TE.map(() => void 0)
  );

export const processItem = ({
  itemTimeoutInSeconds,
  queuePayload,
  retrievedDbItem
}: ItemToProcess): RTE.ReaderTaskEither<
  TriggerDependencies,
  TransientError,
  void
> =>
  pipe(
    RTE.ask<TriggerDependencies>(),
    RTE.chainW(({ SessionNotificationsRepo }) =>
      SessionNotificationsRepo.updateExpiredSessionNotificationFlag(
        retrievedDbItem.id,
        retrievedDbItem.expiredAt,
        true
      )
    ),
    RTE.mapLeft(
      e =>
        new TransientError(
          `Error updating expired session flag(EXPIRED_SESSION): ${e.kind}`
        )
    ),
    RTE.chainW(() =>
      pipe(
        sendMessage(itemTimeoutInSeconds, queuePayload),
        RTE.orElseW(handleQueueInsertFailure(retrievedDbItem))
      )
    )
  );

export const processChunk = (
  chunk: ReadonlyArray<ItemToProcess>
): RTE.ReaderTaskEither<
  TriggerDependencies,
  ReadonlyArray<TransientError>,
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
        RA.getSemigroup<TransientError>()
      )
    ),
    RTE.map(() => void 0)
  );

export const retrieveFromDbInChunks: (
  interval: Interval
) => RTE.ReaderTaskEither<
  TriggerDependencies,
  TransientError,
  ReadonlyArray<ReadonlyArray<ItemToProcess>>
> = (interval: Interval) => (deps: TriggerDependencies) =>
  pipe(
    deps.SessionNotificationsRepo.findByExpiredAtAsyncIterable(interval)(deps),
    TE.of,
    TE.chainW(
      flow(asyncIterableToArray, asyncIterator =>
        TE.tryCatch(
          () => asyncIterator,
          _ =>
            new TransientError(
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

/**
 * Extracts the date from the context binding data for the expired sessions discoverer timer if provided,
 * otherwise defaults to the current date.
 *
 * This function retrieves the date to use for the expired sessions discoverer timer from the context,
 * which is expected to be found when the function is triggered manually and passed in the body of the request.
 * If the date is not provided, it defaults to the current date, e.g. when the function is triggered by a timer.
 *
 * If the provided date is invalid, it returns a left with an error indicating the invalid date.
 *
 * @param context - The Azure Function context containing the binding data.
 * @return An Either containing the date if valid, or an error if the date is invalid or not provided.
 */
export const getDate = (context: Context): E.Either<Error, Date> =>
  pipe(
    O.fromNullable(context.bindingData?.expiredSessionsDiscovererTimer?.date),
    O.map(rawDate =>
      pipe(
        new Date(rawDate),
        E.fromPredicate(
          date => !isNaN(date.getTime()),
          () =>
            new Error(
              "Invalid date provided in context for expired sessions discoverer timer"
            )
        )
      )
    ),
    O.getOrElse(() => E.right(new Date()))
  );

const trackTransientErrors = (
  interval: Interval,
  errors: ReadonlyArray<TransientError> | TransientError
): void =>
  pipe(Array.isArray(errors) ? errors : [errors], errorList =>
    errorList.forEach(err => {
      trackEvent({
        name:
          "io.citizen-auth.prof-async.expired-sessions-discoverer.transient",
        properties: {
          message: err.message,
          stack: err.stack,
          interval
        },
        tagOverrides: {
          samplingEnabled: "false"
        }
      });
    })
  );

export const ExpiredSessionsDiscovererFunction = (
  deps: TriggerDependencies
): AzureFunction => async (
  context: Context,
  _timer: unknown
): Promise<void> => {
  const interval = pipe(
    getDate(context),
    E.map(createInterval),
    E.getOrElseW(error => {
      throw error;
    })
  );
  return pipe(
    retrieveFromDbInChunks(interval),
    RTE.chainW(
      flow(
        RA.map(processChunk),
        RA.sequence(
          RTE.getApplicativeReaderTaskValidation(
            T.ApplicativeSeq,
            RA.getSemigroup<TransientError>()
          )
        ),
        RTE.map(() => void 0)
      )
    ),
    RTE.getOrElse(errors => {
      // Track each TransientError occurred on processing
      trackTransientErrors(interval, errors);

      if (isLastTimerTriggerRetry(context)) {
        trackEvent({
          name:
            "io.citizen-auth.prof-async.expired-sessions-discoverer.max-retry-reached",
          properties: {
            message: "Reached max retry for expired sessions",
            interval
          },
          tagOverrides: {
            samplingEnabled: "false"
          }
        });
      }
      throw new Error("One or more chunks failed during processing");
    })
  )(deps)();
};
