import { CosmosErrors } from "@pagopa/io-functions-commons/dist/src/utils/cosmosdb_model";
import { FiscalCode } from "@pagopa/ts-commons/lib/strings";
import * as R from "fp-ts/lib/Reader";
import * as RTE from "fp-ts/ReaderTaskEither";
import * as t from "io-ts";
import {
  NotificationEvents,
  SESSION_NOTIFICATIONS_ROW_PK_FIELD,
  SessionNotifications,
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
  interval: Interval
) => R.Reader<
  Dependencies,
  AsyncIterable<ReadonlyArray<t.Validation<SessionNotifications>>>
> = interval => deps =>
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
    100
  );

/**
 * Updates notification events for a session-notifications document.
 *
 * @param fiscalCode The fiscal code of the user
 * @param notificationEvents The notification events to update
 * @returns A TaskEither that resolves to the updated session-notifications document
 * */
export const updateNotificationEvents: (
  fiscalCode: FiscalCode | string,
  expiredAt: number,
  notificationEvents: NotificationEvents,
  maxRetry?: number
) => RTE.ReaderTaskEither<Dependencies, CosmosErrors, SessionNotifications> = (
  fiscalCode,
  expiredAt,
  notificationEvents
) => deps =>
  deps.sessionNotificationsModel.patch([fiscalCode, expiredAt], {
    notificationEvents
  });

export type SessionNotificationsRepository = typeof SessionNotificationsRepository;
export const SessionNotificationsRepository = {
  findByExpiredAtAsyncIterable,
  updateNotificationEvents
};
