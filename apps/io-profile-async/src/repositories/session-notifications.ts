import { SqlQuerySpec } from "@azure/cosmos";
import { mapAsyncIterable } from "@pagopa/io-functions-commons/dist/src/utils/async";
import { CosmosErrors } from "@pagopa/io-functions-commons/dist/src/utils/cosmosdb_model";
import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";
import { FiscalCode, NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { pipe } from "fp-ts/lib/function";
import * as R from "fp-ts/lib/Reader";
import * as RTE from "fp-ts/ReaderTaskEither";
import * as TE from "fp-ts/TaskEither";
import * as t from "io-ts";
import {
  SESSION_NOTIFICATIONS_MODEL_KEY_FIELD,
  SESSION_NOTIFICATIONS_ROW_PK_FIELD,
  SessionNotificationsModel
} from "../models/session-notifications";
import { Interval } from "../types/interval";
import { RetrievedSessionNotificationsStrict } from "../types/session-notification-strict";

export type Dependencies = {
  readonly sessionNotificationsModel: SessionNotificationsModel;
};

const findUsingStrictAsyncIterable: (
  query: string | SqlQuerySpec,
  cosmosChunkSize: number
) => R.Reader<
  Dependencies,
  AsyncIterable<
    ReadonlyArray<t.Validation<RetrievedSessionNotificationsStrict>>
  >
> = (query, cosmosChunkSize) => deps =>
  pipe(
    deps.sessionNotificationsModel.buildAsyncIterable(query, cosmosChunkSize),
    iterator =>
      mapAsyncIterable(iterator, feedResponse =>
        feedResponse.resources.map(RetrievedSessionNotificationsStrict.decode)
      )
  );

/**
 * Finds session-notifications documents with expiredAt within a given interval.
 *
 * @param interval The interval to search for
 * @returns A TaskEither that resolves to an array of all session-notifications documents within the interval
 */
const findByExpiredAtAsyncIterable = (
  interval: Interval,
  chunkSize: number
): R.Reader<
  Dependencies,
  AsyncIterable<
    ReadonlyArray<t.Validation<RetrievedSessionNotificationsStrict>>
  >
> =>
  findUsingStrictAsyncIterable(
    {
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
    },
    chunkSize
  );

// TODO: Add Tests
/**
 * Finds session-notifications documents by fiscalCode.
 *
 * @param interval The interval to search for
 * @returns A TaskEither that resolves to an array of all session-notifications documents having the given fiscalCode
 */
const findByFiscalCodeAsyncIterable = (
  fiscalCode: FiscalCode,
  chunkSize: number
): R.Reader<
  Dependencies,
  AsyncIterable<
    ReadonlyArray<t.Validation<RetrievedSessionNotificationsStrict>>
  >
> =>
  findUsingStrictAsyncIterable(
    {
      parameters: [
        {
          name: "@fiscalCode",
          value: fiscalCode
        }
      ],
      query: `SELECT * FROM c WHERE c.${SESSION_NOTIFICATIONS_MODEL_KEY_FIELD} = @fiscalCode`
    },
    chunkSize
  );

// TODO: Add Tests
const deleteRecord: (
  fiscalCode: FiscalCode,
  expiredAt: number
) => RTE.ReaderTaskEither<Dependencies, CosmosErrors, void> = (
  fiscalCode,
  expiredAt
) => deps => deps.sessionNotificationsModel.delete([fiscalCode, expiredAt]);

// TODO: Add Tests
const createRecord: (
  fiscalCode: FiscalCode,
  expiredAt: number,
  ttl: NonNegativeInteger
) => RTE.ReaderTaskEither<Dependencies, CosmosErrors, void> = (
  fiscalCode: FiscalCode,
  expiredAt: number,
  ttl: NonNegativeInteger
) => deps =>
  pipe(
    deps.sessionNotificationsModel.create({
      id: (fiscalCode as unknown) as NonEmptyString,
      expiredAt,
      notificationEvents: {},
      ttl,
      kind: "INewSessionNotifications"
    }),
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
    deps.sessionNotificationsModel.patch([fiscalCode, expiredAt], {
      notificationEvents: {
        EXPIRED_SESSION: flagNewValue
      }
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
