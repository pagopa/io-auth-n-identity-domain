import {
  FiscalCodeSchema,
  GenericError,
  NotFoundError,
} from "@pagopa/hexagonal-core";
import type { SessionPort } from "@pagopa/io-auth-n-identity-session/ports";
import type {
  AuthEventPort,
  InvalidatePreviousUserStateUseCase,
  PlatformInternalPort,
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
const findActiveSession = vi.fn<SessionPort["findActiveSession"]>();
const findSessionTokenBySessionId =
  vi.fn<SessionPort["findSessionTokenBySessionId"]>();
const deleteSession = vi.fn<PlatformInternalPort["deleteSession"]>();
const sessionTokenWithId = {
  sessionId: "session-id",
  hashedSessionToken: "hashed-token",
} as unknown as NonNullable<
  Awaited<ReturnType<SessionPort["findSessionTokenBySessionId"]>> extends {
    value: infer V;
  }
    ? V
    : never
>;

const lockUserSession = makeTechnicalLockUserSessionUseCase({
  technicalLockedProfilesPort,
  authEventPort,
  invalidatePreviousUserStateUseCase: invalidatePreviousUserState,
  platformInternalPort: { deleteSession },
  sessionPort: { findActiveSession, findSessionTokenBySessionId },
});
const unlockUserSession = makeTechnicalUnlockUserSessionUseCase(
  technicalLockedProfilesPort,
);

beforeEach(() => {
  findActiveSession
    .mockReset()
    .mockResolvedValue(
      ok({ sessionId: "session-id" } as Awaited<
        ReturnType<SessionPort["findActiveSession"]>
      > extends { value: infer V }
        ? V
        : never),
    );
  findSessionTokenBySessionId
    .mockReset()
    .mockResolvedValue(ok(sessionTokenWithId));
  deleteSession.mockReset().mockResolvedValue(ok(undefined));
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

  it("invalidates the session token cache before locking", async () => {
    await lockUserSession({ fiscalCode });

    expect(deleteSession).toHaveBeenCalledExactlyOnceWith(
      "session-id.hashed-token",
    );
    expect(deleteSession.mock.invocationCallOrder[0]).toBeLessThan(
      lock.mock.invocationCallOrder[0],
    );
  });

  it("skips the cache invalidation when there is no active session", async () => {
    findActiveSession.mockResolvedValueOnce(err(new NotFoundError("none")));

    expect(await lockUserSession({ fiscalCode })).toEqual(ok(undefined));
    expect(deleteSession).not.toHaveBeenCalled();
    expect(lock).toHaveBeenCalledExactlyOnceWith(fiscalCode);
  });

  it("does not lock when the cache invalidation fails", async () => {
    const cacheError = new GenericError("cache down");
    deleteSession.mockResolvedValueOnce(err(cacheError));

    expect(await lockUserSession({ fiscalCode })).toEqual(
      err(
        new GenericError(
          `Failed to invalidate session token cache: ${cacheError.message}`,
        ),
      ),
    );
    expect(lock).not.toHaveBeenCalled();
    expect(sendEvent).not.toHaveBeenCalled();
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
