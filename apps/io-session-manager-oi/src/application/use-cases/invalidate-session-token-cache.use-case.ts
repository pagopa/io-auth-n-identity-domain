import { GenericError, UseCase } from "@pagopa/hexagonal-core";
import type { HashedSessionTokenWithSessionId } from "@pagopa/io-auth-n-identity-session";
import { err, ok, type Result } from "neverthrow";

import type { PlatformInternalPort } from "../../domain/ports/outbound/platform-internal.port.js";
import { HashedClientSessionTokenSchema } from "../../domain/value-objects/client-session-token.vo.js";

export type InvalidateSessionTokenCacheUseCase = UseCase<
  HashedSessionTokenWithSessionId,
  void,
  GenericError
>;

export const makeInvalidateSessionTokenCacheUseCase =
  (deps: {
    platformInternalPort: PlatformInternalPort;
  }): InvalidateSessionTokenCacheUseCase =>
  async (previousHashedSession: HashedSessionTokenWithSessionId) => {
    /************************************************************************************/
    /* Revoke the previous hashed client session token in the platform-internal service */
    /************************************************************************************/
    const hashedClientSessionTokenParseResult =
      HashedClientSessionTokenSchema.safeParse(
        `${previousHashedSession.sessionId}.${previousHashedSession.hashedSessionToken}`,
      );
    // This should never happen, but we check it just in case, to avoid sending an invalid token to the platform-internal service.
    if (!hashedClientSessionTokenParseResult.success) {
      return err(
        new GenericError(
          `Failed to parse hashed client session token: ${hashedClientSessionTokenParseResult.error.message}`,
        ),
      );
    }
    const cachedSessionInvalidationResult =
      await deps.platformInternalPort.deleteSession(
        hashedClientSessionTokenParseResult.data,
      );

    if (cachedSessionInvalidationResult.isErr()) {
      return err(
        new GenericError(
          `Failed to invalidate previous session on proxy: ${cachedSessionInvalidationResult.error.message}`,
        ),
      );
    }

    return ok(undefined);
  };
