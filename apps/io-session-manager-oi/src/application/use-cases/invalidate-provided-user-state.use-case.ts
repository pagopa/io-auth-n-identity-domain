import { GenericError, type UseCase } from "@pagopa/hexagonal-core";
import type { SessionWithHashedSSOTokens } from "@pagopa/io-auth-n-identity-session/entities";
import type { SessionPort } from "@pagopa/io-auth-n-identity-session/ports";

import {
  makeInvalidateUserStateUseCase,
  type UserStateInvalidationDeps,
} from "./invalidate-user-state.use-case.js";

export type InvalidateProvidedUserStateUseCase = UseCase<
  SessionWithHashedSSOTokens,
  void,
  GenericError
>;

/**
 * Creates the provided-user-state invalidation use case for logout.
 *
 * Specializes the shared higher-order factory with a functional Strategy that
 * calls `sessionPort.delete` for the authenticated session and returns its token
 * for cache invalidation. It reuses the same Lollipop and cache workflow as
 * previous-state invalidation without calling `invalidatePreviousSession`.
 *
 * @param deps - Session port and shared user-state invalidation dependencies.
 * @returns A use case accepting a session with hashed SSO tokens and deleting its state.
 */
export const makeInvalidateProvidedUserStateUseCase = (
  deps: UserStateInvalidationDeps & { sessionPort: SessionPort },
): InvalidateProvidedUserStateUseCase =>
  makeInvalidateUserStateUseCase({
    ...deps,
    invalidateSession: async (session: SessionWithHashedSSOTokens) =>
      (await deps.sessionPort.delete(session))
        .map(() => ({
          sessionId: session.sessionId,
          hashedSessionToken: session.hashedSessionToken,
        }))
        .mapErr(
          (error) =>
            new GenericError(`Failed to delete user session: ${error.message}`),
        ),
  });
