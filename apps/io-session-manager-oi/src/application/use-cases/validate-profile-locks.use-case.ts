import {
  type FiscalCode,
  ForbiddenError,
  GenericError,
  type UseCase,
} from "@pagopa/hexagonal-core";
import { SpidLevel } from "@pagopa/io-auth-n-identity-session";
import { err, ok } from "neverthrow";
import type { LockedProfilesPort } from "../../domain/ports/outbound/locked-profiles.port.js";
import type { TechnicalLockedProfilesPort } from "../../domain/ports/outbound/technical-locked-profiles.port.js";

export class ProfileLockedError extends ForbiddenError {
  override readonly tag = "profile-locked" as const;
}

export class TechnicalProfileLockedError extends ForbiddenError {
  override readonly tag = "technical-profile-locked" as const;
}

type ValidateProfileLocksInput = {
  fiscalCode: FiscalCode;
  spidLevel: SpidLevel;
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
  async ({ fiscalCode, spidLevel }) => {
    if (spidLevel !== "https://www.spid.gov.it/SpidL3") {
      const isLockedResult = await deps.lockedProfilesPort.isLocked(fiscalCode);
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

    const isTechnicalLockedResult =
      await deps.technicalLockedProfilesPort.isLocked(fiscalCode);
    if (isTechnicalLockedResult.isErr()) {
      return err(
        new GenericError(
          `Error checking if profile is technically locked: ${isTechnicalLockedResult.error.message}`,
        ),
      );
    } else if (isTechnicalLockedResult.value) {
      return err(new TechnicalProfileLockedError());
    }

    return ok(undefined);
  };
