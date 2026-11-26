import {
  type FiscalCode,
  GenericError,
  NotFoundError,
  type UseCase,
} from "@pagopa/hexagonal-core";
import type { AuthEvent } from "@pagopa/io-auth-n-identity-session";
import type { SessionPort } from "@pagopa/io-auth-n-identity-session/ports";
import type {
  AuthEventPort,
  InvalidatePreviousUserStateUseCase,
  PlatformInternalPort,
  TechnicalLockedProfilesPort,
} from "@pagopa/io-session-manager-core";
import { err, ok, type Result } from "neverthrow";

type TechnicalLockUserSessionInput = {
  fiscalCode: FiscalCode;
};
type LogoutEvent = Extract<AuthEvent, { eventType: "logout" }>;

type TechnicalLockUserSessionDeps = {
  technicalLockedProfilesPort: TechnicalLockedProfilesPort;
  authEventPort: AuthEventPort;
  invalidatePreviousUserStateUseCase: InvalidatePreviousUserStateUseCase;
  platformInternalPort: PlatformInternalPort;
  sessionPort: Pick<
    SessionPort,
    "findActiveSession" | "findSessionTokenBySessionId"
  >;
};

export type TechnicalLockUserSessionUseCase = UseCase<
  TechnicalLockUserSessionInput,
  void,
  GenericError
>;

/**
 * Deletes the platform cache entry of the user's current session token.
 * A user without an active session has nothing to invalidate.
 */
const invalidateSessionTokenCache = async (
  deps: TechnicalLockUserSessionDeps,
  fiscalCode: FiscalCode,
): Promise<Result<void, GenericError>> => {
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

export const makeTechnicalLockUserSessionUseCase =
  (deps: TechnicalLockUserSessionDeps): TechnicalLockUserSessionUseCase =>
  async ({ fiscalCode }) => {
    const cacheResult = await invalidateSessionTokenCache(deps, fiscalCode);
    if (cacheResult.isErr()) {
      return err(cacheResult.error);
    }

    const lockResult = await deps.technicalLockedProfilesPort.lock(fiscalCode);
    if (lockResult.isErr()) {
      return err(
        new GenericError(
          `Failed to lock technical profile: ${lockResult.error.message}`,
        ),
      );
    }

    const invalidationResult =
      await deps.invalidatePreviousUserStateUseCase(fiscalCode);
    if (invalidationResult.isErr()) {
      return err(invalidationResult.error);
    }

    const logoutEvent: LogoutEvent = {
      eventType: "logout",
      fiscalCode,
      scenario: "account_removal",
      ts: new Date(),
    };
    // TODO: track the `service-bus.auth-event.emission-failure` telemetry event
    // when the logout event publishing fails, as the legacy io-session-manager-internal does
    const eventResult: Result<void, GenericError> =
      await deps.authEventPort.sendEvent(logoutEvent);
    return eventResult.isErr() ? err(eventResult.error) : ok(undefined);
  };
