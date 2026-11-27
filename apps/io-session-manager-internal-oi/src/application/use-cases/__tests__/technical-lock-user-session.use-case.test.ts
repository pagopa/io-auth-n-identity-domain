import { FiscalCodeSchema, GenericError } from "@pagopa/hexagonal-core";
import type {
  InvalidatePreviousUserStateUseCase,
  TechnicalLockedProfilesPort,
} from "@pagopa/io-session-manager-core";
import { err, ok } from "neverthrow";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { InvalidateSessionTokenCacheUseCase } from "../invalidate-session-token-cache.js";
import type { SendLogoutEventUseCase } from "../send-logout-event.js";
import { makeTechnicalLockUserSessionUseCase } from "../technical-lock-user-session.use-case.js";

const fiscalCode = FiscalCodeSchema.parse("ISPXNB32R82Y766D");
const lock = vi.fn<TechnicalLockedProfilesPort["lock"]>();
const invalidateSessionTokenCache = vi.fn<InvalidateSessionTokenCacheUseCase>();
const sendLogoutEvent = vi.fn<SendLogoutEventUseCase>();
const invalidatePreviousUserState = vi.fn<InvalidatePreviousUserStateUseCase>();

const lockTechnicalProfile = makeTechnicalLockUserSessionUseCase({
  technicalLockedProfilesPort: {
    isLocked: vi.fn(),
    lock,
    unlock: vi.fn(),
  },
  invalidateSessionTokenCacheUseCase: invalidateSessionTokenCache,
  sendLogoutEventUseCase: sendLogoutEvent,
  invalidatePreviousUserStateUseCase: invalidatePreviousUserState,
});

beforeEach(() => {
  vi.resetAllMocks();
  invalidateSessionTokenCache.mockResolvedValue(ok(undefined));
  sendLogoutEvent.mockResolvedValue(ok(undefined));
  invalidatePreviousUserState.mockResolvedValue(ok(undefined));
  lock.mockResolvedValue(ok(undefined));
});

describe("makeTechnicalLockUserSessionUseCase", () => {
  it("invalidates cache, locks, invalidates state, then publishes logout", async () => {
    const result = await lockTechnicalProfile({ fiscalCode });

    expect(result).toEqual(ok(undefined));
    expect(invalidateSessionTokenCache).toHaveBeenCalledExactlyOnceWith(
      fiscalCode,
    );
    expect(lock).toHaveBeenCalledExactlyOnceWith(fiscalCode);
    expect(invalidatePreviousUserState).toHaveBeenCalledExactlyOnceWith(
      fiscalCode,
    );
    expect(sendLogoutEvent).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        eventType: "logout",
        fiscalCode,
        scenario: "account_removal",
        ts: expect.any(Date),
      }),
    );
    expect(
      invalidateSessionTokenCache.mock.invocationCallOrder[0],
    ).toBeLessThan(lock.mock.invocationCallOrder[0]);
    expect(lock.mock.invocationCallOrder[0]).toBeLessThan(
      invalidatePreviousUserState.mock.invocationCallOrder[0],
    );
    expect(
      invalidatePreviousUserState.mock.invocationCallOrder[0],
    ).toBeLessThan(sendLogoutEvent.mock.invocationCallOrder[0]);
  });

  it("does not lock when cache invalidation fails", async () => {
    const error = new GenericError("cache down");
    invalidateSessionTokenCache.mockResolvedValueOnce(err(error));

    expect(await lockTechnicalProfile({ fiscalCode })).toEqual(err(error));
    expect(lock).not.toHaveBeenCalled();
    expect(sendLogoutEvent).not.toHaveBeenCalled();
  });

  it("stops when the technical profile lock fails", async () => {
    const error = new GenericError("table unavailable");
    lock.mockResolvedValueOnce(err(error));

    expect(await lockTechnicalProfile({ fiscalCode })).toEqual(
      err(
        new GenericError(`Failed to lock technical profile: ${error.message}`),
      ),
    );
    expect(invalidatePreviousUserState).not.toHaveBeenCalled();
    expect(sendLogoutEvent).not.toHaveBeenCalled();
  });

  it("does not publish logout when invalidating the previous state fails", async () => {
    const error = new GenericError("invalidation failed");
    invalidatePreviousUserState.mockResolvedValueOnce(err(error));

    expect(await lockTechnicalProfile({ fiscalCode })).toEqual(err(error));
    expect(sendLogoutEvent).not.toHaveBeenCalled();
  });

  it("returns an auth-event error after invalidating the previous state", async () => {
    const error = new GenericError("event publishing failed");
    sendLogoutEvent.mockResolvedValueOnce(err(error));

    expect(await lockTechnicalProfile({ fiscalCode })).toEqual(err(error));
    expect(invalidatePreviousUserState).toHaveBeenCalledExactlyOnceWith(
      fiscalCode,
    );
  });
});
