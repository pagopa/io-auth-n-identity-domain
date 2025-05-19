import { CosmosErrors } from "@pagopa/io-functions-commons/dist/src/utils/cosmosdb_model";
import { FiscalCode } from "@pagopa/ts-commons/lib/strings";
import { pipe } from "fp-ts/lib/function";
import * as R from "fp-ts/lib/Reader";
import * as RTE from "fp-ts/ReaderTaskEither";
import * as TE from "fp-ts/TaskEither";
import * as t from "io-ts";
import {
  NotificationEvents,
  RetrievedSessionNotifications,
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
  interval: Interval,
  chunckSize: number
) => R.Reader<
  Dependencies,
  AsyncIterable<ReadonlyArray<t.Validation<RetrievedSessionNotifications>>>
> = (interval, chunckSize) => deps =>
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
    chunckSize
  );

// TODO: this method is not used anymore, remove it
/**
 * Updates notification events for a session-notifications document.
 *
 * @param fiscalCode The fiscal code of the user
 * @param notificationEvents The notification events to update
 * @returns A TaskEither that resolves to the updated session-notifications document
 * */
export const updateNotificationEvents: (
  fiscalCode: FiscalCode,
  expiredAt: number,
  notificationEvents: NotificationEvents
) => RTE.ReaderTaskEither<Dependencies, CosmosErrors, SessionNotifications> = (
  fiscalCode,
  expiredAt,
  notificationEvents
) => deps =>
  deps.sessionNotificationsModel.patch([fiscalCode, expiredAt], {
    notificationEvents
  });

// TODO: add tests
const updateExpiredSessionNotificationFlag: (
  actualRecord: RetrievedSessionNotifications,
  flagNewValue: boolean
) => RTE.ReaderTaskEither<Dependencies, CosmosErrors, void> = (
  actualRecord: RetrievedSessionNotifications,
  flagNewValue: boolean
) => (deps: Dependencies) =>
  pipe(
    deps.sessionNotificationsModel.patch(
      [actualRecord.id, actualRecord.expiredAt],
      {
        notificationEvents: {
          ...actualRecord.notificationEvents,
          EXPIRED_SESSION: flagNewValue
        }
      }
    ),
    TE.map(() => void 0)
  );

export type SessionNotificationsRepository = typeof SessionNotificationsRepository;
export const SessionNotificationsRepository = {
  findByExpiredAtAsyncIterable,
  updateNotificationEvents,
  updateExpiredSessionNotificationFlag
};
