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

import { makeUnlockUserSessionHandler } from "../unlock-user-session";

import { httpHandlerInputMocks } from "../__mocks__/handler.mock";
import {
  BlockedUsersServiceMock,
  mockUnlockUserSession,
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

describe("UnlockUserSession handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should succeed if a session is found", async () => {
    const result = await makeUnlockUserSessionHandler({
      ...dependenciesMock,
      input: aValidRequest,
    })();

    expect(mockUnlockUserSession).toHaveBeenCalledTimes(1);

    expect(result).toEqual(E.right(H.successJson({ message: "ok" })));
  });

  it("should fail on invalid fiscal code", async () => {
    const req = {
      ...H.request("mockUrl"),
      path: {
        fiscalCode: "abcd",
      },
    };

    const result = await makeUnlockUserSessionHandler({
      ...dependenciesMock,
      input: req,
    })();

    expect(mockUnlockUserSession).toHaveBeenCalledTimes(0);

    expect(result).toMatchObject(E.right({ body: { status: 400 } }));
  });

  it("should fail if SessionService fails", async () => {
    const errorMessage = "An error";
    mockUnlockUserSession.mockReturnValueOnce(RTE.left(Error(errorMessage)));

    const result = await makeUnlockUserSessionHandler({
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
