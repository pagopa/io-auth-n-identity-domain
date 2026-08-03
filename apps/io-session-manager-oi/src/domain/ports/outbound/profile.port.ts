import {
  EmailAddress,
  FiscalCode,
  NonEmptyString,
  type ConflictError,
  type GenericError,
  type NotFoundError,
} from "@pagopa/hexagonal-core";
import { type Result } from "neverthrow";

import { UserProfile } from "../../entities/profile.entity.js";

export interface NotifyLoginParams {
  fiscalCode: FiscalCode;
  name: NonEmptyString;
  familyName: NonEmptyString;
  email: EmailAddress;
  identityProvider: NonEmptyString;
  ipAddress: string;
  isEmailValidated?: boolean;
}

export interface ProfilePort {
  getProfile(
    fiscalCode: FiscalCode,
  ): Promise<Result<UserProfile, NotFoundError | GenericError>>;
  create(
    newProfile: UserProfile,
  ): Promise<Result<UserProfile, ConflictError | GenericError>>;
  notifyLogin(params: NotifyLoginParams): Promise<Result<void, GenericError>>;
}
