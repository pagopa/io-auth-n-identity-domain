import {
  FiscalCode,
  type ConflictError,
  type GenericError,
  type NotFoundError,
} from "@pagopa/hexagonal-core";
import { type Result } from "neverthrow";
import { UserProfile } from "../../entities/profile.entity.js";

export interface ProfilePort {
  getProfile(
    fiscalCode: FiscalCode,
  ): Promise<Result<UserProfile, NotFoundError | GenericError>>;
  create(
    newProfile: UserProfile,
  ): Promise<Result<UserProfile, ConflictError | GenericError>>;
}
