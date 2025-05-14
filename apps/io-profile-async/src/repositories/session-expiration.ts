import { FiscalCode } from "@pagopa/ts-commons/lib/strings";
import * as RTE from "fp-ts/ReaderTaskEither";
import * as TE from "fp-ts/TaskEither";
import * as t from "io-ts";
import { CosmosErrors } from "@pagopa/io-functions-commons/dist/src/utils/cosmosdb_model";
import {
  SESSION_EXPIRATION_ROW_KEY_FIELD,
  SessionExpiration,
  SessionExpirationModel
} from "../models/session-expiration-model";
import { Interval } from "../types/interval";

export type Dependencies = {
  readonly sessionExpirationModel: SessionExpirationModel;
};

/**
 * Finds session expiration documents with expirationDate within a given interval.
 *
 * @param interval The interval to search for
 * @returns A TaskEither that resolves to an array of all session expiration documents within the interval
 */
const findByExpirationDateAsyncIterable: (
  interval: Interval
) => RTE.ReaderTaskEither<
  Dependencies,
  never,
  AsyncIterable<ReadonlyArray<t.Validation<SessionExpiration>>>
> = interval => deps =>
  TE.of(
    deps.sessionExpirationModel.buildAsyncIterator(
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
        query: `SELECT * FROM c WHERE (c.${SESSION_EXPIRATION_ROW_KEY_FIELD} BETWEEN @from AND @to) AND
                (c.notificationEvents.EXPIRED_SESSION = false OR NOT IS_DEFINED(c.notificationEvents.EXPIRED_SESSION))`
      },
      100,
      1
    )
  );

/**
 * Updates notification events for a session expiration document.
 *
 * @param fiscalCode The fiscal code of the user
 * @param notificationEvents The notification events to update
 * @returns A TaskEither that resolves to the updated session expiration document
 * */
export const updateNotificationEvents: (
  fiscalCode: FiscalCode | string,
  notificationEvents: Partial<SessionExpiration["notificationEvents"]>
) => RTE.ReaderTaskEither<Dependencies, CosmosErrors, SessionExpiration> = (
  fiscalCode,
  notificationEvents
) => deps =>
  deps.sessionExpirationModel.patch([fiscalCode], {
    notificationEvents
  });

export type SessionExpirationRepository = typeof SessionExpirationRepository;
export const SessionExpirationRepository = {
  findByExpirationDateAsyncIterable,
  updateNotificationEvents
};
