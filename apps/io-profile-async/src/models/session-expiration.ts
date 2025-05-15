import { Container, SqlQuerySpec } from "@azure/cosmos";
import {
  BaseModelTTL,
  CosmosdbModelTTL,
  CosmosResourceTTL
} from "@pagopa/io-functions-commons/dist/src/utils/cosmosdb_model_ttl";
import { wrapWithKind } from "@pagopa/io-functions-commons/dist/src/utils/types";
import * as t from "io-ts";

export const SESSION_EXPIRATION_MODEL_KEY_FIELD = "id";
export const SESSION_EXPIRATION_ROW_PK_FIELD = "expiredAt";

export const NotificationEvents = t.partial({
  EXPIRED_SESSION: t.boolean,
  EXPIRING_SESSION: t.boolean
});

export type NotificationEvents = t.TypeOf<typeof NotificationEvents>;

export const SessionExpiration = t.type({
  id: t.string,
  expirationDate: t.number,
  notificationEvents: NotificationEvents
});

export type SessionExpiration = t.TypeOf<typeof SessionExpiration>;

export const NewSessionExpiration = wrapWithKind(
  t.intersection([SessionExpiration, BaseModelTTL]),
  "INewSessionExpiration" as const
);
export type NewSessionExpiration = t.TypeOf<typeof NewSessionExpiration>;

export const RetrievedSessionExpiration = wrapWithKind(
  t.intersection([SessionExpiration, CosmosResourceTTL]),
  "IRetrievedSessionExpiration" as const
);
export type RetrievedSessionExpiration = t.TypeOf<
  typeof RetrievedSessionExpiration
>;

export class SessionExpirationModel extends CosmosdbModelTTL<
  SessionExpiration,
  NewSessionExpiration,
  RetrievedSessionExpiration,
  typeof SESSION_EXPIRATION_MODEL_KEY_FIELD,
  typeof SESSION_EXPIRATION_ROW_PK_FIELD
> {
  constructor(container: Container) {
    super(container, NewSessionExpiration, RetrievedSessionExpiration);
  }

  /**
   * Returns an async iterable of session expiration objects
   *
   * @param query - The SQL query to execute
   * @param cosmosChunkSize - The maximum number of items to return in each page
   * @returns An async iterable of session expiration objects
   */
  public buildAsyncIterable(
    query: string | SqlQuerySpec,
    cosmosChunkSize: number
  ): AsyncIterable<ReadonlyArray<t.Validation<RetrievedSessionExpiration>>> {
    return this.getQueryIterator(query, {
      maxItemCount: cosmosChunkSize
    });
  }
}
