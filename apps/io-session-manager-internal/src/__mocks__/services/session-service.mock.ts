import { vi } from "vitest";
import * as RTE from "fp-ts/lib/ReaderTaskEither";
import { SessionService } from "../../services/session-service";
import { anUnlockedUserSessionState } from "../user.mock";

export const mockInvalidateUserSession = vi
  .fn()
  .mockReturnValue(RTE.right(true));

export const mockGetUserSession = vi
  .fn()
  .mockReturnValue(RTE.right({ active: true }));

export const mockLockUserAuthentication = vi
  .fn()
  .mockReturnValue(RTE.right(null));

export const mockUnlockUserAuthentication = vi
  .fn()
  .mockReturnValue(RTE.right(null));

export const mockDeleteUserSession = vi.fn().mockReturnValue(RTE.right(null));

export const mockGetUserSessionState = vi
  .fn()
  .mockReturnValue(RTE.right(anUnlockedUserSessionState));

export const SessionServiceMock: SessionService = {
  invalidateUserSession: mockInvalidateUserSession,
  getUserSession: mockGetUserSession,
  lockUserAuthentication: mockLockUserAuthentication,
  unlockUserAuthentication: mockUnlockUserAuthentication,
  deleteUserSession: mockDeleteUserSession,
  getUserSessionState: mockGetUserSessionState,
};
