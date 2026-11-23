import { FiscalCodeSchema, GenericError } from "@pagopa/hexagonal-core";
import type {
  AuthEventPort,
  InvalidatePreviousUserStateUseCase,
  TechnicalLockedProfilesPort,
} from "@pagopa/io-session-manager-core";
import { err, ok } from "neverthrow";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  makeTechnicalLockUserSessionUseCase,
  makeTechnicalUnlockUserSessionUseCase,
} from "../technical-lock-user-session.use-case.js";

const fiscalCode = FiscalCodeSchema.parse("ISPXNB32R82Y766D");
const lock = vi.fn<TechnicalLockedProfilesPort["lock"]>();
const unlock = vi.fn<TechnicalLockedProfilesPort["unlock"]>();
const sendEvent = vi.fn<AuthEventPort["sendEvent"]>();
const invalidatePreviousUserState = vi.fn<InvalidatePreviousUserStateUseCase>();
const technicalLockedProfilesPort: TechnicalLockedProfilesPort = {
  isLocked: vi.fn<TechnicalLockedProfilesPort["isLocked"]>(),
  lock,
  unlock,
};
const authEventPort: AuthEventPort = { sendEvent };

const lockUserSession = makeTechnicalLockUserSessionUseCase({
  technicalLockedProfilesPort,
  authEventPort,
  invalidatePreviousUserStateUseCase: invalidatePreviousUserState,
});
const unlockUserSession = makeTechnicalUnlockUserSessionUseCase(
  technicalLockedProfilesPort,
);

beforeEach(() => {
  lock.mockReset().mockResolvedValue(ok(undefined));
  unlock.mockReset().mockResolvedValue(ok(undefined));
  sendEvent.mockReset().mockResolvedValue(ok(undefined));
  invalidatePreviousUserState.mockReset().mockResolvedValue(ok(undefined));
});

describe("makeTechnicalLockUserSessionUseCase", () => {
  it("locks the profile, invalidates the previous state, then publishes logout", async () => {
    const result = await lockUserSession({ fiscalCode });

    expect(result).toEqual(ok(undefined));
    expect(lock).toHaveBeenCalledExactlyOnceWith(fiscalCode);
    expect(invalidatePreviousUserState).toHaveBeenCalledExactlyOnceWith(
      fiscalCode,
    );
    expect(sendEvent).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        eventType: "logout",
        fiscalCode,
        scenario: "account_removal",
      }),
    );
    const logoutEvent = sendEvent.mock.calls[0]?.[0];
    expect(logoutEvent).toBeDefined();
    if (!logoutEvent) {
      throw new Error("Expected a logout event to be published");
    }
    expect(logoutEvent).toMatchObject({
      eventType: "logout",
      fiscalCode,
      scenario: "account_removal",
    });
    expect(logoutEvent.ts).toBeInstanceOf(Date);
    expect(lock.mock.invocationCallOrder[0]).toBeLessThan(
      invalidatePreviousUserState.mock.invocationCallOrder[0],
    );
    expect(
      invalidatePreviousUserState.mock.invocationCallOrder[0],
    ).toBeLessThan(sendEvent.mock.invocationCallOrder[0]);
  });

  it("stops when the technical profile lock fails", async () => {
    const storageError = new GenericError("table unavailable");
    lock.mockResolvedValueOnce(err(storageError));

    const result = await lockUserSession({ fiscalCode });

    expect(result).toEqual(
      err(
        new GenericError(
          `Failed to lock technical profile: ${storageError.message}`,
        ),
      ),
    );
    expect(invalidatePreviousUserState).not.toHaveBeenCalled();
    expect(sendEvent).not.toHaveBeenCalled();
  });

  it("does not publish logout when invalidating the previous state fails", async () => {
    const invalidationError = new GenericError("invalidation failed");
    invalidatePreviousUserState.mockResolvedValueOnce(err(invalidationError));

    const result = await lockUserSession({ fiscalCode });

    expect(result).toEqual(err(invalidationError));
    expect(lock).toHaveBeenCalledExactlyOnceWith(fiscalCode);
    expect(sendEvent).not.toHaveBeenCalled();
  });

  it("returns an auth-event error after invalidating the previous state", async () => {
    const eventError = new GenericError("event publishing failed");
    sendEvent.mockResolvedValueOnce(err(eventError));

    const result = await lockUserSession({ fiscalCode });

    expect(result).toEqual(err(eventError));
    expect(lock).toHaveBeenCalledExactlyOnceWith(fiscalCode);
    expect(invalidatePreviousUserState).toHaveBeenCalledExactlyOnceWith(
      fiscalCode,
    );
  });
});

describe("makeTechnicalUnlockUserSessionUseCase", () => {
  it("unlocks the profile", async () => {
    expect(await unlockUserSession({ fiscalCode })).toEqual(ok(undefined));
    expect(unlock).toHaveBeenCalledExactlyOnceWith(fiscalCode);
  });

  it("converts a technical profile unlock failure to a generic error", async () => {
    const storageError = new GenericError("table unavailable");
    unlock.mockResolvedValueOnce(err(storageError));

    expect(await unlockUserSession({ fiscalCode })).toEqual(
      err(
        new GenericError(
          `Failed to unlock technical profile: ${storageError.message}`,
        ),
      ),
    );
  });
});
