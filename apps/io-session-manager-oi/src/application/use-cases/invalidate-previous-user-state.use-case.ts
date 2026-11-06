import {
  type FiscalCode,
  GenericError,
  NotFoundError,
  type UseCase,
} from "@pagopa/hexagonal-core";
import type {
  LollipopActivationPort,
  SessionPort,
} from "@pagopa/io-auth-n-identity-session/ports";
import { err, ok } from "neverthrow";

import type { LollipopRevocationPort } from "../../domain/ports/outbound/lollipop-revocation.port.js";

import type { InvalidateSessionTokenCacheUseCase } from "./invalidate-session-token-cache.use-case.js";

export type InvalidatePreviousUserStateUseCase = UseCase<
  FiscalCode,
  void,
  GenericError
>;

type Dependencies = {
  sessionPort: SessionPort;
  lollipopActivationPort: LollipopActivationPort;
  lollipopRevocationPort: LollipopRevocationPort;
  invalidateSessionTokenCacheUseCase: InvalidateSessionTokenCacheUseCase;
};

/**
 * Invalidates the previous user state for a given fiscal code. This includes revoking any existing lollipop activations, invalidating previous sessions, and attempting to invalidate the session token cache.
 * @param deps The dependencies required by the use-case, including ports and other use-cases.
 * @returns A use-case function that invalidates the previous user state for a given fiscal code, including revoking lollipop activations and invalidating sessions.
 */
export const makeInvalidatePreviousUserStateUseCase =
  (deps: Dependencies): InvalidatePreviousUserStateUseCase =>
  async (fiscalCode) => {
    const activationResult =
      await deps.lollipopActivationPort.getByFiscalCode(fiscalCode);
    if (activationResult.isOk()) {
      // Public-key revocation is best-effort and must not block invalidation.
      void deps.lollipopRevocationPort
        .requestRevocation(activationResult.value.assertionRef)
        .then((result) => {
          if (result.isErr()) {
            console.error(`Failed to revoke lollipop: ${result.error.message}`);
          }
        });
    } else if (!(activationResult.error instanceof NotFoundError)) {
      return err(
        new GenericError(
          `Failed to retrieve previous lollipop activation data: ${activationResult.error.message}`,
        ),
      );
    }

    // Revoke the association between the fiscal code and the lollipop activation
    const revokeFiscalCodeToLollipopAssociationResult =
      await deps.lollipopActivationPort.revokeByFiscalCode(fiscalCode);
    if (revokeFiscalCodeToLollipopAssociationResult.isErr()) {
      return err(
        new GenericError(
          `Failed to revoke the "fiscal code - lollipop" association: ${revokeFiscalCodeToLollipopAssociationResult.error.message}`,
        ),
      );
    }

    // Invalidate previous user sessions associated with the fiscal code
    const invalidationResult =
      await deps.sessionPort.invalidatePreviousSession(fiscalCode);
    if (invalidationResult.isErr()) {
      return err(
        new GenericError(
          `Failed to invalidate previous sessions: ${invalidationResult.error.message}`,
        ),
      );
    }
    if (invalidationResult.value === undefined) {
      return ok(undefined);
    }

    // Invalidate the session token cache for the invalidated sessions (best-effort, non-blocking)
    deps
      .invalidateSessionTokenCacheUseCase(invalidationResult.value)
      .then((cacheInvalidationResult) => {
        if (cacheInvalidationResult.isErr()) {
          console.error(
            `Failed to invalidate session token cache: ${cacheInvalidationResult.error.message}`,
          );
        }
      });

    return ok(undefined);
  };
