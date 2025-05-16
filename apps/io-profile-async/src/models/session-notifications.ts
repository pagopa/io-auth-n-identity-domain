import { Container, SqlQuerySpec } from "@azure/cosmos";
import {
  BaseModelTTL,
  CosmosdbModelTTL,
  CosmosResourceTTL
} from "@pagopa/io-functions-commons/dist/src/utils/cosmosdb_model_ttl";
import { wrapWithKind } from "@pagopa/io-functions-commons/dist/src/utils/types";
import * as t from "io-ts";

export const SESSION_NOTIFICATIONS_MODEL_KEY_FIELD = "id";
export const SESSION_NOTIFICATIONS_ROW_PK_FIELD = "expiredAt";

export const NotificationEvents = t.partial({
  EXPIRED_SESSION: t.boolean,
  EXPIRING_SESSION: t.boolean
});

export type NotificationEvents = t.TypeOf<typeof NotificationEvents>;

export const SessionNotifications = t.type({
  id: t.string,
  expiredAt: t.number,
  notificationEvents: NotificationEvents
});

export type SessionNotifications = t.TypeOf<typeof SessionNotifications>;

export const NewSessionNotifications = wrapWithKind(
  t.intersection([SessionNotifications, BaseModelTTL]),
  "INewSessionNotifications" as const
);
export type NewSessionNotifications = t.TypeOf<typeof NewSessionNotifications>;

export const RetrievedSessionNotifications = wrapWithKind(
  t.intersection([SessionNotifications, CosmosResourceTTL]),
  "IRetrievedSessionNotifications" as const
);
export type RetrievedSessionNotifications = t.TypeOf<
  typeof RetrievedSessionNotifications
>;

export class SessionNotificationsModel extends CosmosdbModelTTL<
  SessionNotifications,
  NewSessionNotifications,
  RetrievedSessionNotifications,
  typeof SESSION_NOTIFICATIONS_MODEL_KEY_FIELD,
  typeof SESSION_NOTIFICATIONS_ROW_PK_FIELD
> {
  constructor(container: Container) {
    super(container, NewSessionNotifications, RetrievedSessionNotifications);
  }

  /**
   * Returns an async iterable of session-notifications objects
   *
   * @param query - The SQL query to execute
   * @param cosmosChunkSize - The maximum number of items to return in each page
   * @returns An async iterable of session-notifications objects
   */
  public buildAsyncIterable(
    query: string | SqlQuerySpec,
    cosmosChunkSize: number
  ): AsyncIterable<ReadonlyArray<t.Validation<RetrievedSessionNotifications>>> {
    return this.getQueryIterator(query, {
      maxItemCount: cosmosChunkSize
    });
  }
}
