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
import { AssertionRef } from "../generated/lollipop/AssertionRef";

export const LOLLIPOACTIVATIONS_COLLECTION_NAME =
  "lollipop-activations" as const;
export const LOLLIPOPACTIVATIONS_MODEL_ID_FIELD = "id" as const;
export const LOLLIPOPACTIVATIONS_MODEL_PK_FIELD = "id" as const;

type LolliPopActivationRepositoryDeps = {
  container: Container;
};

// Parsed document
export const LolliPopActivation = t.intersection([
  t.type({
    assertionRef: AssertionRef,
    fiscalCode: FiscalCode,
  }),
  Ttl,
]);
export type LolliPopActivation = t.TypeOf<typeof LolliPopActivation>;

export const RetrievedLolliPopActivation = t.intersection([
  LolliPopActivation,
  AzureCosmosResource,
]);
export type RetrievedLolliPopActivation = t.TypeOf<
  typeof RetrievedLolliPopActivation
>;

const getLollipopActivation =
  (deps: LolliPopActivationRepositoryDeps) =>
  (parameters: {
    id: FiscalCode;
  }): TE.TaskEither<
    GenericError | DecodeError | NotFoundError,
    RetrievedLolliPopActivation
  > =>
    performPointRead(deps)({
      id: parameters.id,
      partitionKey: parameters.id,
      codec: RetrievedLolliPopActivation,
    });

const createLollipopActivation =
  (deps: LolliPopActivationRepositoryDeps) =>
  (parameters: {
    document: LolliPopActivation;
  }): TE.TaskEither<GenericError | ConflictError, void> =>
    performInsert(deps)(parameters);

export const LolliPopActivationRepository = {
  getLollipopActivation,
  createLollipopActivation,
};
