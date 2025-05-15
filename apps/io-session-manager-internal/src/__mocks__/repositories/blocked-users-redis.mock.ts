import * as RTE from "fp-ts/lib/ReaderTaskEither";

import { vi } from "vitest";
import { BlockedUsersRedisRepository } from "../../repositories/blocked-users-redis";

export const mockUnsetBlockedUser = vi.fn().mockReturnValue(RTE.right(true));
export const mockSetBlockedUser = vi.fn().mockReturnValue(RTE.right(true));

export const BlockedUsersRedisRepositoryMock: BlockedUsersRedisRepository = {
  unsetBlockedUser: mockUnsetBlockedUser,
  setBlockedUser: mockSetBlockedUser,
};
