import {
  type FiscalCode,
  ForbiddenError,
  GenericError,
  type UseCase,
} from "@pagopa/hexagonal-core";
import { err, ok } from "neverthrow";

import type { LockedProfilesPort } from "../../domain/ports/outbound/locked-profiles.port.js";
import type { TechnicalLockedProfilesPort } from "../../domain/ports/outbound/technical-locked-profiles.port.js";

export class ProfileLockedError extends ForbiddenError {
  override readonly tag = "profile-locked" as const;
}

export class TechnicalProfileLockedError extends ForbiddenError {
  override readonly tag = "technical-profile-locked" as const;
}

export type ProfileLockCheck = "user-set" | "technical";

type ValidateProfileLocksInput = {
  fiscalCode: FiscalCode;
  checks: readonly ProfileLockCheck[];
};

export type ValidateProfileLocksUseCase = UseCase<
  ValidateProfileLocksInput,
  void,
  ProfileLockedError | TechnicalProfileLockedError | GenericError
>;

type Dependencies = {
  lockedProfilesPort: LockedProfilesPort;
  technicalLockedProfilesPort: TechnicalLockedProfilesPort;
};

export const makeValidateProfileLocksUseCase =
  (deps: Dependencies): ValidateProfileLocksUseCase =>
  async ({ fiscalCode, checks }) => {
    const [isLockedResult, isTechnicalLockedResult] = await Promise.all([
      checks.includes("user-set")
        ? deps.lockedProfilesPort.isLocked(fiscalCode)
        : undefined,
      checks.includes("technical")
        ? deps.technicalLockedProfilesPort.isLocked(fiscalCode)
        : undefined,
    ]);

    if (isLockedResult) {
      if (isLockedResult.isErr()) {
        return err(
          new GenericError(
            `Error checking if profile is locked: ${isLockedResult.error.message}`,
          ),
        );
      } else if (isLockedResult.value) {
        return err(new ProfileLockedError());
      }
    }

    if (isTechnicalLockedResult) {
      if (isTechnicalLockedResult.isErr()) {
        return err(
          new GenericError(
            `Error checking if profile is technically locked: ${isTechnicalLockedResult.error.message}`,
          ),
        );
      } else if (isTechnicalLockedResult.value) {
        return err(new TechnicalProfileLockedError());
      }
    }

    return ok(undefined);
  };
