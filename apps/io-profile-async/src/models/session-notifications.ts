import {
  Container,
  FeedResponse,
  RequestOptions,
  SqlQuerySpec
} from "@azure/cosmos";
import {
  CosmosErrors,
  DocumentSearchKey,
  toCosmosErrorResponse
} from "@pagopa/io-functions-commons/dist/src/utils/cosmosdb_model";
import {
  BaseModelTTL,
  CosmosdbModelTTL,
  CosmosResourceTTL
} from "@pagopa/io-functions-commons/dist/src/utils/cosmosdb_model_ttl";
import { wrapWithKind } from "@pagopa/io-functions-commons/dist/src/utils/types";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/lib/TaskEither";
import * as t from "io-ts";

export const SESSION_NOTIFICATIONS_MODEL_KEY_FIELD = "id";
export const SESSION_NOTIFICATIONS_ROW_PK_FIELD = "expiredAt";

export const NotificationEvents = t.partial({
  EXPIRED_SESSION: t.boolean,
  EXPIRING_SESSION: t.boolean
});

export type NotificationEvents = t.TypeOf<typeof NotificationEvents>;

export const SessionNotifications = t.type({
  id: NonEmptyString,
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
  ): AsyncIterable<FeedResponse<unknown>> {
    return this.container.items
      .query(query, {
        maxItemCount: cosmosChunkSize
      })
      .getAsyncIterator();
  }

  /**
   * Delete a document by its id and partition key.
   *
   * @param searchKey The tuple of values used to identify the document. It can be [documentId] or [documentId, partitionKey] depending on the model.
   * @param options Optional request options.
   */
  public delete(
    searchKey: DocumentSearchKey<
      RetrievedSessionNotifications,
      typeof SESSION_NOTIFICATIONS_MODEL_KEY_FIELD,
      typeof SESSION_NOTIFICATIONS_ROW_PK_FIELD
    >,
    options?: RequestOptions
  ): TE.TaskEither<CosmosErrors, void> {
    const documentId = searchKey[0];
    const partitionKey = searchKey[1] || documentId;

    return pipe(
      TE.tryCatch(
        () => this.container.item(documentId, partitionKey).delete(options),
        toCosmosErrorResponse
      ),
      TE.map(() => void 0)
    );
  }
}
