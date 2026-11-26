import {
  type FiscalCode,
  GenericError,
  NotFoundError,
  type UseCase,
} from "@pagopa/hexagonal-core";
import type { SessionPort } from "@pagopa/io-auth-n-identity-session/ports";
import type { PlatformInternalPort } from "@pagopa/io-session-manager-core";
import { err, ok } from "neverthrow";

type InvalidateSessionTokenCacheDeps = {
  platformInternalPort: PlatformInternalPort;
  sessionPort: Pick<
    SessionPort,
    "findActiveSession" | "findSessionTokenBySessionId"
  >;
};

export type InvalidateSessionTokenCacheUseCase = UseCase<
  FiscalCode,
  void,
  GenericError
>;

/**
 * Deletes the platform cache entry of the user's current session token.
 * A user without an active session has nothing to invalidate.
 */
export const makeInvalidateSessionTokenCacheUseCase =
  (deps: InvalidateSessionTokenCacheDeps): InvalidateSessionTokenCacheUseCase =>
  async (fiscalCode) => {
    const activeSession = await deps.sessionPort.findActiveSession(fiscalCode);
    if (activeSession.isErr()) {
      return activeSession.error instanceof NotFoundError
        ? ok(undefined)
        : err(activeSession.error);
    }

    const token = await deps.sessionPort.findSessionTokenBySessionId(
      activeSession.value.sessionId,
    );
    if (token.isErr()) {
      return err(token.error);
    }
    if (token.value === undefined) {
      return ok(undefined);
    }

    const deleteResult = await deps.platformInternalPort.deleteSession(
      `${token.value.sessionId}.${token.value.hashedSessionToken}`,
    );
    return deleteResult.isErr()
      ? err(
          new GenericError(
            `Failed to invalidate session token cache: ${deleteResult.error.message}`,
          ),
        )
      : ok(undefined);
  };
