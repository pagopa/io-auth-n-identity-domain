import { ResultAsync } from "neverthrow";
import {
  AuthenticationError,
  ConflictError,
  FiscalCode,
  GenericError,
  NotFoundError,
  TooManyRequestsError,
  ValidationError,
} from "@pagopa/hexagonal-core";
import {
  ExtendedProfileSchema,
  NewProfile,
} from "../../value-objects/profile/profile.value-object.js";

export interface ProfileClientI {
  readonly getProfile: (
    fiscalCode: FiscalCode,
  ) => ResultAsync<
    ExtendedProfileSchema,
    | GenericError
    | ValidationError
    | AuthenticationError
    | NotFoundError
    | TooManyRequestsError
  >;

  readonly createProfile: (
    payload: NewProfile,
  ) => ResultAsync<
    ExtendedProfileSchema,
    | GenericError
    | ValidationError
    | AuthenticationError
    | ConflictError
    | TooManyRequestsError
  >;
}
