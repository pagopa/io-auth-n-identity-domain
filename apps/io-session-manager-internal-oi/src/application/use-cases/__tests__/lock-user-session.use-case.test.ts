import {
  ConflictError,
  FiscalCodeSchema,
  GenericError,
} from "@pagopa/hexagonal-core";
import {
  type InvalidatePreviousUserStateUseCase,
  type LockedProfilesPort,
  type NotificationPort,
  UnlockCodeSchema,
} from "@pagopa/io-session-manager-core";
import { err, ok } from "neverthrow";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { makeLockUserSessionUseCase } from "../lock-user-session.use-case.js";
import type { InvalidateSessionTokenCacheUseCase } from "../invalidate-session-token-cache.js";
import type { SendLogoutEventUseCase } from "../send-logout-event.js";

const fiscalCode = FiscalCodeSchema.parse("ISPXNB32R82Y766D");
const unlockCode = UnlockCodeSchema.parse("012345678");
const isLocked = vi.fn<LockedProfilesPort["isLocked"]>();
const lock = vi.fn<LockedProfilesPort["lock"]>();
const invalidatePreviousUserState = vi.fn<InvalidatePreviousUserStateUseCase>();
const deleteInstallation = vi.fn<NotificationPort["deleteInstallation"]>();
const invalidateSessionTokenCache = vi.fn<InvalidateSessionTokenCacheUseCase>();
const sendLogoutEvent = vi.fn<SendLogoutEventUseCase>();

const useCase = makeLockUserSessionUseCase({
  lockedProfilesPort: { isLocked, lock, unlock: vi.fn(), healthcheck: vi.fn() },
  invalidatePreviousUserStateUseCase: invalidatePreviousUserState,
  notificationPort: { deleteInstallation },
  invalidateSessionTokenCacheUseCase: invalidateSessionTokenCache,
  sendLogoutEventUseCase: sendLogoutEvent,
});

beforeEach(() => {
  vi.resetAllMocks();
  isLocked.mockResolvedValue(ok(false));
  lock.mockResolvedValue(ok(undefined));
  invalidateSessionTokenCache.mockResolvedValue(ok(undefined));
  invalidatePreviousUserState.mockResolvedValue(ok(undefined));
  deleteInstallation.mockResolvedValue(ok(undefined));
  sendLogoutEvent.mockResolvedValue(ok(undefined));
});

describe("makeLockUserSessionUseCase installation cleanup", () => {
  it("requests installation deletion after session invalidation and before logout", async () => {
    expect(await useCase({ fiscalCode, unlockCode })).toEqual(ok(undefined));

    expect(deleteInstallation).toHaveBeenCalledExactlyOnceWith(fiscalCode);
    expect(
      invalidatePreviousUserState.mock.invocationCallOrder[0],
    ).toBeLessThan(deleteInstallation.mock.invocationCallOrder[0]);
    expect(deleteInstallation.mock.invocationCallOrder[0]).toBeLessThan(
      sendLogoutEvent.mock.invocationCallOrder[0],
    );
  });

  it("returns the cleanup error without publishing logout", async () => {
    const error = new GenericError("Notification queue unavailable");
    deleteInstallation.mockResolvedValueOnce(err(error));

    expect(await useCase({ fiscalCode, unlockCode })).toEqual(err(error));
    expect(sendLogoutEvent).not.toHaveBeenCalled();
  });

  it("does not delete the installation when session invalidation fails", async () => {
    const error = new GenericError("Session invalidation failed");
    invalidatePreviousUserState.mockResolvedValueOnce(err(error));

    expect(await useCase({ fiscalCode, unlockCode })).toEqual(err(error));
    expect(deleteInstallation).not.toHaveBeenCalled();
    expect(sendLogoutEvent).not.toHaveBeenCalled();
  });
});

describe("makeLockUserSessionUseCase lock persistence", () => {
  it("persists the lock after the cleanup and before logout", async () => {
    expect(await useCase({ fiscalCode, unlockCode })).toEqual(ok(undefined));

    expect(lock).toHaveBeenCalledExactlyOnceWith(fiscalCode, unlockCode);
    expect(deleteInstallation.mock.invocationCallOrder[0]).toBeLessThan(
      lock.mock.invocationCallOrder[0],
    );
    expect(lock.mock.invocationCallOrder[0]).toBeLessThan(
      sendLogoutEvent.mock.invocationCallOrder[0],
    );
  });

  it("returns a conflict without touching the session when already locked", async () => {
    isLocked.mockResolvedValueOnce(ok(true));

    const result = await useCase({ fiscalCode, unlockCode });

    expect(result._unsafeUnwrapErr()).toBeInstanceOf(ConflictError);
    expect(lock).not.toHaveBeenCalled();
    expect(invalidatePreviousUserState).not.toHaveBeenCalled();
  });

  it("does not publish logout when the lock write fails", async () => {
    lock.mockResolvedValueOnce(err(new GenericError("write failed")));

    const result = await useCase({ fiscalCode, unlockCode });

    expect(result._unsafeUnwrapErr()).toBeInstanceOf(GenericError);
    expect(sendLogoutEvent).not.toHaveBeenCalled();
  });
});
