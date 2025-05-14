import { Container, SqlQuerySpec } from "@azure/cosmos";
import {
  BaseModelTTL,
  CosmosdbModelTTL,
  CosmosResourceTTL
} from "@pagopa/io-functions-commons/dist/src/utils/cosmosdb_model_ttl";
import { wrapWithKind } from "@pagopa/io-functions-commons/dist/src/utils/types";
import * as t from "io-ts";

// The partition key field for the session expiration model which is the fiscal code
export const SESSION_EXPIRATION_MODEL_KEY_FIELD = "id";
export const SESSION_EXPIRATION_ROW_PK_FIELD = "expirationDate";

export const SessionExpiration = t.type({
  // TODO: remove t.string
  id: t.string,
  expirationDate: t.number,
  notificationEvents: t.partial({
    EXPIRED_SESSION: t.boolean,
    EXPIRING_SESSION: t.boolean
  })
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
   * Build a Cosmos query iterator for session expiration documents.
   */
  public buildAsyncIterator(
    query: string | SqlQuerySpec,
    cosmosChunkSize: number,
    cosmosDegreeOfParallelism: number
  ): AsyncIterable<ReadonlyArray<t.Validation<SessionExpiration>>> {
    return this.getQueryIterator(query, {
      maxDegreeOfParallelism: cosmosDegreeOfParallelism,
      maxItemCount: cosmosChunkSize
    });
  }
}
