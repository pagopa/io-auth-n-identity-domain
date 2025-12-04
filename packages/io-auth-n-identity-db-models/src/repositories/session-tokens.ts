import * as t from "io-ts";
import * as TE from "fp-ts/lib/TaskEither";
import { Container } from "@azure/cosmos";
import { pipe } from "fp-ts/lib/function";
import { FiscalCode, NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import {
  AzureCosmosResource,
  performPointRead,
  performTransaction,
  Ttl,
} from "../utils/cosmosdb";
import {
  DecodeError,
  GenericError,
  NotFoundError,
  toGenericError,
} from "../utils/errors";

export const SESSIONTOKENS_COLLECTION_NAME = "tokens" as const;
export const SESSIONTOKENS_MODEL_ID_FIELD = "id" as const;
export const SESSIONTOKENS_MODEL_PK_FIELD = "sessionTrackingId" as const;

// Parsed document
export const UserFields = t.intersection([
  t.type({
    dateOfBirth: NonEmptyString,
    familyName: NonEmptyString,
    fiscalCode: FiscalCode,
    name: NonEmptyString,
    // TODO: change to spidLevel type
    spidLevel: NonEmptyString,
  }),
  t.partial({
    // Optional User Attributes
    spidEmail: NonEmptyString,
  }),
]);

export type UserFields = t.TypeOf<typeof UserFields>;

export const CommonFields = t.type({
  id: NonEmptyString,
  sessionTrackingId: NonEmptyString,
});
export type CommonFields = t.TypeOf<typeof CommonFields>;

// t.exact strips away additional properties during encode/decode
// no additional properties should go on db
export const SessionDocument = t.exact(
  t.intersection([
    UserFields,
    CommonFields,
    t.type({
      bpdToken: NonEmptyString,
      fimsToken: NonEmptyString,
      walletToken: NonEmptyString,
      zendeskToken: NonEmptyString,
    }),
    Ttl,
  ]),
);
export type SessionDocument = t.TypeOf<typeof SessionDocument>;

export const RetrievedSessionDocument = t.intersection([
  SessionDocument,
  AzureCosmosResource,
]);
export type RetrievedSessionDocument = t.TypeOf<
  typeof RetrievedSessionDocument
>;

// t.exact strips away additional properties during encode/decode
// no additional properties should go on db
export const SsoDocument = t.exact(
  t.intersection([UserFields, CommonFields, Ttl]),
);
export type SsoDocument = t.TypeOf<typeof SsoDocument>;

export const RetrievedSsoDocument = t.intersection([
  SsoDocument,
  AzureCosmosResource,
]);
export type RetrievedSsoDocument = t.TypeOf<typeof RetrievedSsoDocument>;

type SessionTokenRepositoryDeps = {
  container: Container;
};

const getSessionToken =
  <searchKey extends string>(deps: SessionTokenRepositoryDeps) =>
  (parameters: {
    id: searchKey;
    sessionTrackingId: searchKey;
  }): TE.TaskEither<
    GenericError | DecodeError | NotFoundError,
    RetrievedSessionDocument
  > =>
    performPointRead(deps)({
      id: parameters.id,
      partitionKey: parameters.sessionTrackingId,
      codec: RetrievedSessionDocument,
    });

const createSessionTokens =
  (deps: SessionTokenRepositoryDeps) =>
  (parameters: {
    sessionDocument: SessionDocument;
    // only 4 sso documents allowed
    ssoDocuments: readonly [SsoDocument, SsoDocument, SsoDocument, SsoDocument];
  }): TE.TaskEither<GenericError, void> =>
    pipe(
      performTransaction(deps)({
        batch: [
          {
            resourceBody: SessionDocument.encode(parameters.sessionDocument),
            operationType: "Create",
          },
          ...parameters.ssoDocuments.map((doc) => ({
            resourceBody: SsoDocument.encode(doc),
            operationType: "Create" as const,
          })),
        ],
        partitionKey: parameters.sessionDocument.sessionTrackingId,
      }),
      TE.map((_) => void 0),
      TE.mapLeft((e) => toGenericError(e.causedBy?.message)),
    );

const getSSOToken =
  <searchKey extends string>(deps: SessionTokenRepositoryDeps) =>
  (parameters: {
    id: searchKey;
    sessionTrackingId: searchKey;
  }): TE.TaskEither<
    GenericError | DecodeError | NotFoundError,
    RetrievedSsoDocument
  > =>
    performPointRead(deps)({
      id: parameters.id,
      partitionKey: parameters.sessionTrackingId,
      codec: RetrievedSsoDocument,
    });

export const SessionTokensRepository = {
  getSessionToken,
  getSSOToken,
  createSessionTokens,
};
