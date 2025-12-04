import * as t from "io-ts";
import * as TE from "fp-ts/lib/TaskEither";
import { FiscalCode, NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { Container } from "@azure/cosmos";
import {
  AzureCosmosResource,
  performInsert,
  performPointRead,
  Ttl,
} from "../utils/cosmosdb";
import {
  ConflictError,
  DecodeError,
  GenericError,
  NotFoundError,
} from "../utils/errors";

export const SESSIONLINKS_COLLECTION_NAME = "lollipop-activations" as const;
export const SESSIONLINKS_MODEL_ID_FIELD = "fiscalCode" as const;
export const SESSIONLINKS_MODEL_PK_FIELD = "fiscalCode" as const;

type SessionLinksRepositoryDeps = {
  container: Container;
};

// Parsed document
export const SessionLink = t.type({
  fiscalCode: FiscalCode,
  sessions: t.array(NonEmptyString),
});
export type SessionLink = t.TypeOf<typeof SessionLink>;

export const RetrievedSessionLink = t.intersection([
  SessionLink,
  AzureCosmosResource,
]);
export type RetrievedSessionLink = t.TypeOf<typeof RetrievedSessionLink>;

const getSessionLink =
  (deps: SessionLinksRepositoryDeps) =>
  (parameters: {
    fiscalCode: FiscalCode;
  }): TE.TaskEither<
    GenericError | DecodeError | NotFoundError,
    RetrievedSessionLink
  > =>
    performPointRead(deps)({
      id: parameters.fiscalCode,
      partitionKey: parameters.fiscalCode,
      codec: RetrievedSessionLink,
    });

const createSessionLink =
  (deps: SessionLinksRepositoryDeps) =>
  (parameters: {
    document: SessionLink;
  }): TE.TaskEither<GenericError | ConflictError, void> =>
    performInsert(deps)(parameters);

export const SessionLinkRepository = {
  getSessionLink,
  createSessionLink,
};
