import {
  type FiscalCode,
  GenericError,
  type UseCase,
} from "@pagopa/hexagonal-core";
import type { AuthEvent } from "@pagopa/io-auth-n-identity-session";
import type {
  AuthEventPort,
  InvalidatePreviousUserStateUseCase,
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
};

export type TechnicalLockUserSessionUseCase = UseCase<
  TechnicalLockUserSessionInput,
  void,
  GenericError
>;

export const makeTechnicalLockUserSessionUseCase =
  (deps: TechnicalLockUserSessionDeps): TechnicalLockUserSessionUseCase =>
  async ({ fiscalCode }) => {
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
    const eventResult: Result<void, GenericError> =
      await deps.authEventPort.sendEvent(logoutEvent);
    return eventResult.isErr() ? err(eventResult.error) : ok(undefined);
  };

export type TechnicalUnlockUserSessionUseCase = UseCase<
  TechnicalLockUserSessionInput,
  void,
  GenericError
>;

export const makeTechnicalUnlockUserSessionUseCase =
  (
    technicalLockedProfilesPort: TechnicalLockedProfilesPort,
  ): TechnicalUnlockUserSessionUseCase =>
  async ({ fiscalCode }) => {
    const unlockResult = await technicalLockedProfilesPort.unlock(fiscalCode);
    return unlockResult.isErr()
      ? err(
          new GenericError(
            `Failed to unlock technical profile: ${unlockResult.error.message}`,
          ),
        )
      : ok(undefined);
  };
