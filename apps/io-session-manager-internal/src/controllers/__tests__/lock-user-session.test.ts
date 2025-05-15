import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueueClient } from "@azure/storage-queue";
import * as E from "fp-ts/lib/Either";
import * as TE from "fp-ts/lib/TaskEither";
import * as RTE from "fp-ts/lib/ReaderTaskEither";
import * as H from "@pagopa/handler-kit";
import { RedisClusterType } from "redis";

import { SessionService } from "../../services/session-service";
import { LollipopRepository } from "../../repositories/lollipop";
import { BlockedUsersRedisRepository } from "../../repositories/blocked-users-redis";
import { RedisRepository } from "../../repositories/redis";

import { makeLockUserSessionHandler } from "../lock-user-session";

import { httpHandlerInputMocks } from "../__mocks__/handler.mock";
import {
  BlockedUsersServiceMock,
  mockLockUserSession,
} from "../../__mocks__/services/blocked-users-service.mock";

const aFiscalCode = "SPNDNL80R13C555X";

const dependenciesMock = {
  ...httpHandlerInputMocks,
  blockedUsersService: BlockedUsersServiceMock,
  // service is already mocked, no need to mock the repositories
  sessionService: {} as SessionService,
  lollipopRepository: {} as LollipopRepository,
  redisRepository: {} as RedisRepository,
  RevokeAssertionRefQueueClient: {} as QueueClient,
  blockedUserRedisRepository: {} as BlockedUsersRedisRepository,
  fastRedisClientTask: TE.of({} as RedisClusterType),
  safeRedisClientTask: TE.of({} as RedisClusterType),
};

const aValidRequest = {
  ...H.request("mockUrl"),
  path: {
    fiscalCode: aFiscalCode,
  },
};

describe("LockUserSession handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should succeed with a valid request", async () => {
    const result = await makeLockUserSessionHandler({
      ...dependenciesMock,
      input: aValidRequest,
    })();

    expect(mockLockUserSession).toHaveBeenCalledTimes(1);

    expect(result).toEqual(E.right(H.successJson({ message: "ok" })));
  });

  it("should fail on invalid fiscal code", async () => {
    const req = {
      ...H.request("mockUrl"),
      path: {
        fiscalCode: "abcd",
      },
    };

    const result = await makeLockUserSessionHandler({
      ...dependenciesMock,
      input: req,
    })();

    expect(mockLockUserSession).toHaveBeenCalledTimes(0);

    expect(result).toMatchObject(E.right({ body: { status: 400 } }));
  });

  it("should return Internal Server Error if an error occurred locking the user session", async () => {
    const errorMessage = "An error";
    mockLockUserSession.mockReturnValueOnce(RTE.left(Error(errorMessage)));

    const result = await makeLockUserSessionHandler({
      ...dependenciesMock,
      input: aValidRequest,
    })();

    expect(result).toMatchObject(
      E.right({
        body: { status: 500, title: `Internal Server Error: ${errorMessage}` },
      }),
    );
  });
});
