import { beforeEach, describe, expect, it, vi } from "vitest";
import * as E from "fp-ts/lib/Either";
import * as TE from "fp-ts/lib/TaskEither";
import * as RTE from "fp-ts/lib/ReaderTaskEither";

import { BlockedUsersService } from "../blocked-users-service";

import {
  RedisClientTaskMock,
  RedisRepositoryMock,
} from "../../__mocks__/repositories/redis.mock";
import {
  mockUnsetBlockedUser,
  BlockedUsersRedisRepositoryMock,
  mockSetBlockedUser,
} from "../../__mocks__/repositories/blocked-users-redis.mock";
import { aFiscalCode } from "../../repositories/__tests__/blocked-users-redis.test";
import { LollipopRepositoryMock } from "../../__mocks__/repositories/lollipop.mock";
import { mockQueueClient } from "../../__mocks__/queue-client.mock";
import {
  mockInvalidateUserSession,
  SessionServiceMock,
} from "../../__mocks__/services/session-service.mock";

const deps = {
  fastRedisClientTask: RedisClientTaskMock,
  safeRedisClientTask: RedisClientTaskMock,
  blockedUserRedisRepository: BlockedUsersRedisRepositoryMock,
  sessionService: SessionServiceMock,
  lollipopRepository: LollipopRepositoryMock,
  redisRepository: RedisRepositoryMock,
  RevokeAssertionRefQueueClient: mockQueueClient,
};

describe("Blocked Users Service#lockUserSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should succeed locking a user session", async () => {
    const result =
      await BlockedUsersService.lockUserSession(aFiscalCode)(deps)();

    expect(mockInvalidateUserSession).toHaveBeenCalledTimes(1);
    expect(mockSetBlockedUser).toHaveBeenCalledTimes(1);
    expect(result).toEqual(E.right(true));
  });

  it("should fail if an error occurred adding the user to the blocked users list", async () => {
    const customError = Error("custom error");
    mockSetBlockedUser.mockReturnValueOnce(() => TE.left(customError));

    const result =
      await BlockedUsersService.lockUserSession(aFiscalCode)(deps)();

    expect(result).toEqual(E.left(customError));
  });

  it("should fail if an error occurred invalidation the user session", async () => {
    const customError = Error("session invalidation error");
    mockInvalidateUserSession.mockReturnValueOnce(RTE.left(customError));

    const result =
      await BlockedUsersService.lockUserSession(aFiscalCode)(deps)();

    expect(result).toEqual(E.left(customError));
  });
});

describe("Blocked Users Service#unlockUserSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

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
