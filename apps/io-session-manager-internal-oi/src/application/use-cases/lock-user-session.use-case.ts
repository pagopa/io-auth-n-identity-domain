import {
  ConflictError,
  type FiscalCode,
  GenericError,
  type UseCase,
} from "@pagopa/hexagonal-core";
import type { AuthEvent } from "@pagopa/io-auth-n-identity-session";
import type {
  InvalidatePreviousUserStateUseCase,
  LockedProfilesPort,
  NotificationPort,
  UnlockCode,
} from "@pagopa/io-session-manager-core";
import { err } from "neverthrow";

import type { InvalidateSessionTokenCacheUseCase } from "./invalidate-session-token-cache.js";
import type { SendLogoutEventUseCase } from "./send-logout-event.js";

type LockUserSessionInput = {
  fiscalCode: FiscalCode;
  unlockCode: UnlockCode;
};
type LogoutEvent = Extract<AuthEvent, { eventType: "logout" }>;

type LockUserSessionDeps = {
  lockedProfilesPort: LockedProfilesPort;
  notificationPort: NotificationPort;
  invalidateSessionTokenCacheUseCase: InvalidateSessionTokenCacheUseCase;
  sendLogoutEventUseCase: SendLogoutEventUseCase;
  invalidatePreviousUserStateUseCase: InvalidatePreviousUserStateUseCase;
};

export type LockUserSessionUseCase = UseCase<
  LockUserSessionInput,
  void,
  ConflictError | GenericError
>;

export const makeLockUserSessionUseCase =
  (deps: LockUserSessionDeps): LockUserSessionUseCase =>
  async ({ fiscalCode, unlockCode }) => {
    const isLockedResult = await deps.lockedProfilesPort.isLocked(fiscalCode);
    if (isLockedResult.isErr()) {
      const error = new GenericError(
        "Failed to check if user session is locked.",
      );
      error.cause = isLockedResult.error;
      return err(error);
    }

    // A Conflict error is raised if the user session is already locked.
    if (isLockedResult.value) {
      return err(new ConflictError("User session is already locked"));
    }

    const cacheResult =
      await deps.invalidateSessionTokenCacheUseCase(fiscalCode);
    if (cacheResult.isErr()) {
      const error = new GenericError(
        "Failed to invalidate session token cache.",
      );
      error.cause = cacheResult.error;
      return err(error);
    }

    const invalidationResult =
      await deps.invalidatePreviousUserStateUseCase(fiscalCode);
    if (invalidationResult.isErr()) {
      return err(invalidationResult.error);
    }

    const installationResult =
      await deps.notificationPort.deleteInstallation(fiscalCode);
    if (installationResult.isErr()) {
      return err(installationResult.error);
    }

    // The lock is persisted last so a failed attempt can be retried.
    const lockResult = await deps.lockedProfilesPort.lock(
      fiscalCode,
      unlockCode,
    );
    if (lockResult.isErr()) {
      return err(
        lockResult.error instanceof ConflictError
          ? lockResult.error
          : new GenericError(
              `Failed to lock user session: ${lockResult.error.message}`,
            ),
      );
    }

    const logoutEvent: LogoutEvent = {
      eventType: "logout",
      fiscalCode,
      scenario: "auth_lock",
      ts: new Date(),
    };

    return deps.sendLogoutEventUseCase(logoutEvent);
  };
