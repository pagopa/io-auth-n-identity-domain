import { SqlQuerySpec } from "@azure/cosmos";
import { mapAsyncIterable } from "@pagopa/io-functions-commons/dist/src/utils/async";
import { CosmosErrors } from "@pagopa/io-functions-commons/dist/src/utils/cosmosdb_model";
import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";
import { readableReportSimplified } from "@pagopa/ts-commons/lib/reporters";
import { FiscalCode, NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import * as E from "fp-ts/Either";
import { flow, pipe } from "fp-ts/lib/function";
import * as R from "fp-ts/lib/Reader";
import * as RTE from "fp-ts/ReaderTaskEither";
import * as TE from "fp-ts/TaskEither";
import * as t from "io-ts";
import { SessionNotificationsRepositoryConfig } from "../config";
import {
  SESSION_NOTIFICATIONS_MODEL_KEY_FIELD,
  SESSION_NOTIFICATIONS_ROW_PK_FIELD,
  SessionNotificationsModel
} from "../models/session-notifications";
import { Interval } from "../types/interval";
import { RetrievedSessionNotificationsStrict } from "../types/session-notification-strict";
import { PermanentError } from "../utils/errors";

export type Dependencies = {
  readonly sessionNotificationsModel: SessionNotificationsModel;
  readonly sessionNotificationsRepositoryConfig: SessionNotificationsRepositoryConfig;
};

const findUsingStrictAsyncIterable: (
  query: string | SqlQuerySpec
) => R.Reader<
  Dependencies,
  AsyncIterable<
    ReadonlyArray<t.Validation<RetrievedSessionNotificationsStrict>>
  >
> = query => deps =>
  pipe(
    deps.sessionNotificationsModel.buildAsyncIterable(
      query,
      deps.sessionNotificationsRepositoryConfig
        .SESSION_NOTIFICATION_EVENTS_FETCH_CHUNK_SIZE
    ),
    iterator =>
      mapAsyncIterable(iterator, feedResponse =>
        feedResponse.resources.map(RetrievedSessionNotificationsStrict.decode)
      )
  );

/**
 * Finds session-notifications documents with expiredAt within a given interval.
 *
 * @param interval The interval to search for
 * @param chunkSize  The resultSet page size
 * @returns An AsyncIterable that resolves to an array of all session-notifications documents within the interval
 */
const findByExpiredAtAsyncIterable = (
  interval: Interval
): R.Reader<
  Dependencies,
  AsyncIterable<
    ReadonlyArray<t.Validation<RetrievedSessionNotificationsStrict>>
  >
> =>
  findUsingStrictAsyncIterable({
    parameters: [
      {
        name: "@from",
        value: interval.from.getTime()
      },
      {
        name: "@to",
        value: interval.to.getTime()
      }
    ],
    query:
      `SELECT * FROM c WHERE (c.${SESSION_NOTIFICATIONS_ROW_PK_FIELD} BETWEEN @from AND @to) AND ` +
      "(c.notificationEvents.EXPIRED_SESSION = false OR NOT IS_DEFINED(c.notificationEvents.EXPIRED_SESSION))"
  });

/**
 * Finds session-notifications documents by fiscalCode.
 *
 * @param fiscalCode The fiscalCode to search for
 * @param chunkSize  The resultSet page size
 * @returns An AsyncIterable that resolves to an array of all session-notifications documents having the given fiscalCode
 */
const findByFiscalCodeAsyncIterable = (
  fiscalCode: FiscalCode
): R.Reader<
  Dependencies,
  AsyncIterable<
    ReadonlyArray<t.Validation<RetrievedSessionNotificationsStrict>>
  >
> =>
  findUsingStrictAsyncIterable({
    parameters: [
      {
        name: "@fiscalCode",
        value: fiscalCode
      }
    ],
    query: `SELECT * FROM c WHERE c.${SESSION_NOTIFICATIONS_MODEL_KEY_FIELD} = @fiscalCode`
  });

/**
 * Delete session-notifications documents by fiscalCode and expiredAt.
 *
 * @param fiscalCode The fiscalCode to search for
 * @param expiredAt  The resultSet page size
 * @returns A ReaderTaskEither that resolves to void if the operation is successful, or an error if it fails
 */
const deleteRecord: (
  fiscalCode: FiscalCode,
  expiredAt: number
) => RTE.ReaderTaskEither<Dependencies, CosmosErrors, void> = (
  fiscalCode,
  expiredAt
) => deps => deps.sessionNotificationsModel.delete([fiscalCode, expiredAt]);

/**
 * Calculate TTL for session-notifications documents creation.
 *
 * @param fiscalCode The fiscalCode to search for
 * @param expiredAt  The resultSet page size
 * @returns A ReaderTaskEither that resolves to void if the operation is successful, or an error if it fails
 */
const calculateRecordTTL = (
  expiredAt: number,
  offsetSeconds: number
): E.Either<PermanentError, NonNegativeInteger> =>
  pipe(
    Math.floor((expiredAt - new Date().getTime()) / 1000) + offsetSeconds,
    NonNegativeInteger.decode,
    E.mapLeft(
      flow(
        readableReportSimplified,
        reason =>
          new PermanentError(
            `Unable to calculate New Record TTL, the reason was => ${reason}`
          )
      )
    )
  );

/**
 * Create a new session-notifications documents.
 *
 * @param fiscalCode The fiscalCode to search for
 * @param expiredAt  The resultSet page size
 * @param ttl The time to live for the document in seconds
 * @returns A ReaderTaskEither that resolves to void if the operation is successful, or an error if it fails
 */
const createRecord: (
  fiscalCode: FiscalCode,
  expiredAt: number
) => RTE.ReaderTaskEither<Dependencies, PermanentError | CosmosErrors, void> = (
  fiscalCode: FiscalCode,
  expiredAt: number
) => deps =>
  pipe(
    calculateRecordTTL(
      expiredAt,
      deps.sessionNotificationsRepositoryConfig
        .SESSION_NOTIFICATION_EVENTS_TTL_OFFSET
    ),
    TE.fromEither,
    TE.chainW(ttl =>
      deps.sessionNotificationsModel.create({
        id: (fiscalCode as unknown) as NonEmptyString,
        expiredAt,
        notificationEvents: {},
        ttl,
        kind: "INewSessionNotifications"
      })
    ),
    TE.map(() => void 0)
  );

/**
 * Updates notification events for a session-notifications document.
 *
 * @param fiscalCode The user fiscal identification code(Container Unique Key for Partition).
 * @param expiredAt The user session expiration date (Container PartitionKey)
 * @param flagNewValue New value for EXPIRED_SESSION flag
 * @returns A Either an Error in case of cosmos error on patch, void in case the operation is succesfully completed
 * */
const updateExpiredSessionNotificationFlag: (
  fiscalCode: FiscalCode,
  expiredAt: number,
  flagNewValue: boolean
) => RTE.ReaderTaskEither<Dependencies, CosmosErrors, void> = (
  fiscalCode,
  expiredAt,
  flagNewValue
) => deps =>
  pipe(
    calculateRecordTTL(
      expiredAt,
      deps.sessionNotificationsRepositoryConfig
        .SESSION_NOTIFICATION_EVENTS_TTL_OFFSET
    ),
    // on error calculateRecordTTL falling back to the default retention ttl time
    E.getOrElse(
      () =>
        deps.sessionNotificationsRepositoryConfig
          .SESSION_NOTIFICATION_EVENTS_TTL_OFFSET as NonNegativeInteger
    ),
    ttl =>
      deps.sessionNotificationsModel.patch([fiscalCode, expiredAt], {
        notificationEvents: {
          EXPIRED_SESSION: flagNewValue
        },
        ttl
      }),
    TE.map(() => void 0)
  );

export type SessionNotificationsRepository = typeof SessionNotificationsRepository;
export const SessionNotificationsRepository = {
  createRecord,
  deleteRecord,
  findByExpiredAtAsyncIterable,
  findByFiscalCodeAsyncIterable,
  updateExpiredSessionNotificationFlag
};
