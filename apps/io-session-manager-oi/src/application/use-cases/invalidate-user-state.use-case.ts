import {
  type FiscalCode,
  GenericError,
  NotFoundError,
  type UseCase,
} from "@pagopa/hexagonal-core";
import type { HashedSessionTokenWithSessionId } from "@pagopa/io-auth-n-identity-session";
import type { LollipopActivationPort } from "@pagopa/io-auth-n-identity-session/ports";
import { err, ok } from "neverthrow";

import type { LollipopRevocationPort } from "../../domain/ports/outbound/lollipop-revocation.port.js";

import type { InvalidateSessionTokenCacheUseCase } from "./invalidate-session-token-cache.use-case.js";

export type UserStateInvalidationDeps = {
  lollipopActivationPort: LollipopActivationPort;
  lollipopRevocationPort: LollipopRevocationPort;
  invalidateSessionTokenCacheUseCase: InvalidateSessionTokenCacheUseCase;
};

/**
 * Creates a user-state invalidation use case through a higher-order factory
 * composed with a functional Strategy pattern.
 *
 * The factory fixes the workflow: request public-key revocation, revoke the
 * fiscal-code/Lollipop association, run the injected session strategy, then
 * invalidate the returned token's cache entry, if any. Public-key revocation
 * and cache invalidation are best-effort and non-blocking; other errors stop
 * the workflow.
 *
 * @typeParam Input - Strategy input containing the user's fiscal code.
 * @param deps - Shared ports, cache invalidation use case and session strategy.
 * @param deps.invalidateSession - Session operation returning the token to
 * invalidate in cache, or undefined when no session was found.
 * @returns A use case sharing the workflow independently of the session operation.
 */
export const makeInvalidateUserStateUseCase =
  <Input extends { fiscalCode: FiscalCode }>(
    deps: UserStateInvalidationDeps & {
      invalidateSession: UseCase<
        Input,
        HashedSessionTokenWithSessionId | undefined,
        GenericError
      >;
    },
  ): UseCase<Input, void, GenericError> =>
  async (input) => {
    const { fiscalCode } = input;
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

    const revocationResult =
      await deps.lollipopActivationPort.revokeByFiscalCode(fiscalCode);
    if (revocationResult.isErr()) {
      return err(
        new GenericError(
          `Failed to revoke the "fiscal code - lollipop" association: ${revocationResult.error.message}`,
        ),
      );
    }

    const invalidationResult = await deps.invalidateSession(input);
    if (invalidationResult.isErr()) {
      return err(invalidationResult.error);
    }

    if (invalidationResult.value !== undefined) {
      // Cache invalidation remains best-effort and starts only after session removal.
      void deps
        .invalidateSessionTokenCacheUseCase(invalidationResult.value)
        .then((result) => {
          if (result.isErr()) {
            console.error(
              `Failed to invalidate session token cache: ${result.error.message}`,
            );
          }
        });
    }

    return ok(undefined);
  };
