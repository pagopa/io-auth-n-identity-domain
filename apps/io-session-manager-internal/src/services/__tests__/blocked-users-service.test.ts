import { beforeEach, describe, expect, it, vi } from "vitest";
import * as E from "fp-ts/lib/Either";
import * as TE from "fp-ts/lib/TaskEither";

import { BlockedUsersService } from "../blocked-users-service";

import { RedisClientTaskMock } from "../../__mocks__/repositories/redis.mock";
import {
  mockUnsetBlockedUser,
  BlockedUsersRedisRepositoryMock,
} from "../../__mocks__/repositories/blocked-users-redis.mock";
import { aFiscalCode } from "../../repositories/__tests__/blocked-users-redis.test";

describe("Blocked Users Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const deps = {
    fastRedisClientTask: RedisClientTaskMock,
    safeRedisClientTask: RedisClientTaskMock,
    blockedUserRedisRepository: BlockedUsersRedisRepositoryMock,
  };

  it("should succeed with an valid user", async () => {
    const result =
      await BlockedUsersService.unlockUserSession(aFiscalCode)(deps)();

    expect(mockUnsetBlockedUser).toHaveBeenCalledTimes(1);
    expect(result).toEqual(E.right(true));
  });

  it("should fail if an error occurred removing the user from the blocked user list", async () => {
    const customError = Error("custom error");
    mockUnsetBlockedUser.mockReturnValueOnce(() => TE.left(customError));

    const result =
      await BlockedUsersService.unlockUserSession(aFiscalCode)(deps)();

    expect(mockUnsetBlockedUser).toHaveBeenCalledTimes(1);
    expect(result).toEqual(E.left(customError));
  });
});
