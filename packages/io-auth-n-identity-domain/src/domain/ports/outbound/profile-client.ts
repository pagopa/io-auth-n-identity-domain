import {
  AuthenticationError,
  ConflictError,
  FiscalCode,
  GenericError,
  NotFoundError,
  TooManyRequestsError,
  ValidationError,
} from "@pagopa/hexagonal-core";
import { ResultAsync } from "neverthrow";
import { StandardSchemaV1, StandardTypedV1 } from "@standard-schema/spec";

import { NewProfile } from "../../entities/profile.entity.js";

export interface ProfileClient<DomainOutputSchema extends StandardSchemaV1> {
  readonly getProfile: (
    fiscalCode: FiscalCode,
  ) => ResultAsync<
    StandardTypedV1.InferOutput<DomainOutputSchema>,
    | GenericError
    | ValidationError
    | AuthenticationError
    | NotFoundError
    | TooManyRequestsError
  >;

  readonly createProfile: (
    fiscalCode: FiscalCode,
    payload: NewProfile,
  ) => ResultAsync<
    StandardTypedV1.InferOutput<DomainOutputSchema>,
    | GenericError
    | ValidationError
    | AuthenticationError
    | ConflictError
    | TooManyRequestsError
  >;
}
