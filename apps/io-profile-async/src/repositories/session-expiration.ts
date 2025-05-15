import { CosmosErrors } from "@pagopa/io-functions-commons/dist/src/utils/cosmosdb_model";
import { FiscalCode } from "@pagopa/ts-commons/lib/strings";
import * as R from "fp-ts/lib/Reader";
import * as RTE from "fp-ts/ReaderTaskEither";
import * as TE from "fp-ts/TaskEither";
import * as T from "fp-ts/Task";
import * as t from "io-ts";
import { pipe } from "fp-ts/lib/function";
import {
  NotificationEvents,
  SESSION_EXPIRATION_ROW_PK_FIELD,
  SessionExpiration,
  SessionExpirationModel
} from "../models/session-expiration";
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
) => R.Reader<
  Dependencies,
  AsyncIterable<ReadonlyArray<t.Validation<SessionExpiration>>>
> = interval => deps =>
  deps.sessionExpirationModel.buildAsyncIterable(
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
        `SELECT * FROM c WHERE (c.${SESSION_EXPIRATION_ROW_PK_FIELD} BETWEEN @from AND @to) AND ` +
        "(c.notificationEvents.EXPIRED_SESSION = false OR NOT IS_DEFINED(c.notificationEvents.EXPIRED_SESSION))"
    },
    100
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
  expirationDate: number,
  notificationEvents: NotificationEvents,
  maxRetry?: number
) => RTE.ReaderTaskEither<Dependencies, CosmosErrors, SessionExpiration> = (
  fiscalCode,
  expirationDate,
  notificationEvents
) => deps =>
  deps.sessionExpirationModel.patch([fiscalCode, expirationDate], {
    notificationEvents
  });

/**
 * Updates notification events for a session expiration document.
 *
 * @param fiscalCode The fiscal code of the user
 * @param notificationEvents The notification events to update
 * @param maxRetry The maximum number of retries
 * @param delay The delay between retries in milliseconds
 * @returns A TaskEither that resolves to the updated session expiration document
 * */
export const updateNotificationEventsWithRetry: (
  fiscalCode: FiscalCode | string,
  expirationDate: number,
  notificationEvents: NotificationEvents,
  maxRetry?: number,
  delay?: number
) => RTE.ReaderTaskEither<Dependencies, CosmosErrors, SessionExpiration> = (
  fiscalCode,
  expirationDate,
  notificationEvents,
  maxRetry = 5,
  delay = 500
) => deps =>
  pipe(
    updateNotificationEvents(
      fiscalCode,
      expirationDate,
      notificationEvents
    )(deps),
    TE.orElse(error => {
      if (maxRetry <= 1) {
        return TE.left(error);
      }
      return pipe(
        TE.fromTask(T.delay(delay)(T.of(undefined))),
        TE.chain(() =>
          updateNotificationEventsWithRetry(
            fiscalCode,
            expirationDate,
            notificationEvents,
            maxRetry - 1,
            delay
          )(deps)
        )
      );
    })
  );

export type SessionExpirationRepository = typeof SessionExpirationRepository;
export const SessionExpirationRepository = {
  findByExpirationDateAsyncIterable,
  updateNotificationEvents,
  updateNotificationEventsWithRetry
};
