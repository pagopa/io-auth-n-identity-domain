import { CosmosErrors } from "@pagopa/io-functions-commons/dist/src/utils/cosmosdb_model";
import { FiscalCode } from "@pagopa/ts-commons/lib/strings";
import { pipe } from "fp-ts/lib/function";
import * as R from "fp-ts/lib/Reader";
import * as RTE from "fp-ts/ReaderTaskEither";
import * as TE from "fp-ts/TaskEither";
import * as t from "io-ts";
import {
  RetrievedSessionNotifications,
  SESSION_NOTIFICATIONS_MODEL_KEY_FIELD,
  SESSION_NOTIFICATIONS_ROW_PK_FIELD,
  SessionNotificationsModel
} from "../models/session-notifications";
import { Interval } from "../types/interval";

export type Dependencies = {
  readonly sessionNotificationsModel: SessionNotificationsModel;
};

/**
 * Finds session-notifications documents with expiredAt within a given interval.
 *
 * @param interval The interval to search for
 * @returns A TaskEither that resolves to an array of all session-notifications documents within the interval
 */
const findByExpiredAtAsyncIterable: (
  interval: Interval,
  chunkSize: number
) => R.Reader<
  Dependencies,
  AsyncIterable<ReadonlyArray<t.Validation<RetrievedSessionNotifications>>>
> = (interval, chunkSize) => deps =>
  deps.sessionNotificationsModel.buildAsyncIterable(
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
const findByFiscalCodeAsyncIterable: (
  fiscalCode: FiscalCode,
  chunkSize: number
) => R.Reader<
  Dependencies,
  AsyncIterable<ReadonlyArray<t.Validation<RetrievedSessionNotifications>>>
> = (fiscalCode, chunkSize) => deps =>
  deps.sessionNotificationsModel.buildAsyncIterable(
    {
      parameters: [
        {
          name: "@fiscalCode",
          value: fiscalCode
        }
      ],
      query: `SELECT * FROM c WHERE c.${SESSION_NOTIFICATIONS_MODEL_KEY_FIELD} = @fiscalCode)`
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
  deleteRecord,
  findByExpiredAtAsyncIterable,
  findByFiscalCodeAsyncIterable,
  updateExpiredSessionNotificationFlag
};
