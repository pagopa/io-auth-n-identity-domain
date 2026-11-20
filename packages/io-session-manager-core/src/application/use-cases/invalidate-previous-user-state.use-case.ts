import {
  type FiscalCode,
  GenericError,
  type UseCase,
} from "@pagopa/hexagonal-core";
import type { SessionPort } from "@pagopa/io-auth-n-identity-session/ports";

import {
  makeInvalidateUserStateUseCase,
  type UserStateInvalidationDeps,
} from "./invalidate-user-state.use-case.js";

export type InvalidatePreviousUserStateUseCase = UseCase<
  FiscalCode,
  void,
  GenericError
>;

/**
 * Creates the previous-user-state invalidation use case for session replacement.
 *
 * Specializes the shared higher-order factory with a functional Strategy that
 * calls `sessionPort.invalidatePreviousSession` for the supplied fiscal code.
 * Lollipop revocation and best-effort cache invalidation remain in the common
 * workflow.
 *
 * @param deps - Session port and shared user-state invalidation dependencies.
 * @returns A use case accepting a fiscal code and invalidating its previous state.
 */
export const makeInvalidatePreviousUserStateUseCase = (
  deps: UserStateInvalidationDeps & { sessionPort: SessionPort },
): InvalidatePreviousUserStateUseCase => {
  const invalidateUserState = makeInvalidateUserStateUseCase({
    ...deps,
    invalidateSession: async ({ fiscalCode }: { fiscalCode: FiscalCode }) =>
      (await deps.sessionPort.invalidatePreviousSession(fiscalCode)).mapErr(
        (error) =>
          new GenericError(
            `Failed to invalidate previous sessions: ${error.message}`,
          ),
      ),
  });

  return (fiscalCode) => invalidateUserState({ fiscalCode });
};
