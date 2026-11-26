import {
  type FiscalCode,
  GenericError,
  type UseCase,
} from "@pagopa/hexagonal-core";
import type { AuthEvent } from "@pagopa/io-auth-n-identity-session";
import type {
  InvalidatePreviousUserStateUseCase,
  TechnicalLockedProfilesPort,
} from "@pagopa/io-session-manager-core";
import { err } from "neverthrow";

import type { InvalidateSessionTokenCacheUseCase } from "./invalidate-session-token-cache.js";
import type { SendLogoutEventUseCase } from "./send-logout-event.js";

type TechnicalLockUserSessionInput = {
  fiscalCode: FiscalCode;
};
type LogoutEvent = Extract<AuthEvent, { eventType: "logout" }>;

type TechnicalLockUserSessionDeps = {
  technicalLockedProfilesPort: TechnicalLockedProfilesPort;
  invalidateSessionTokenCacheUseCase: InvalidateSessionTokenCacheUseCase;
  sendLogoutEventUseCase: SendLogoutEventUseCase;
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
    const cacheResult =
      await deps.invalidateSessionTokenCacheUseCase(fiscalCode);
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
    return deps.sendLogoutEventUseCase(logoutEvent);
  };
