import { vi } from "vitest";
import * as RTE from "fp-ts/lib/ReaderTaskEither";
import { BlockedUsersService } from "../../services/blocked-users-service";

export const mockLockUserSession = vi.fn().mockReturnValue(RTE.right(true));
export const mockUnlockUserSession = vi.fn().mockReturnValue(RTE.right(true));

export const BlockedUsersServiceMock: BlockedUsersService = {
  lockUserSession: mockLockUserSession,
  unlockUserSession: mockUnlockUserSession,
};
