import { beforeEach, describe, expect, it, vi } from "vitest";
const { mockConnect, mockGet } = vi.hoisted(() => ({
  mockConnect: vi.fn().mockResolvedValue({}),
  mockGet: vi.fn().mockResolvedValue("value"),
}));
const { mockCreateClient } = vi.hoisted(() => ({
  mockCreateClient: vi.fn().mockImplementation(() => ({
    connect: mockConnect,
    on: vi.fn(),
    get: mockGet,
  })),
}));
vi.mock("redis", () => ({
  createCluster: mockCreateClient,
}));

import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";
import * as E from "fp-ts/Either";
import { CreateRedisClientSingleton } from "../redis-client";

describe("redisClient creation on startup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each`
    title     | isFastClient
    ${"fast"} | ${true}
    ${"safe"} | ${false}
  `(
    "only one time the $title redis client is created",
    async ({ isFastClient }) => {
      const redisClientTask = CreateRedisClientSingleton(
        {
          REDIS_URL: "redis" as NonEmptyString,
          REDIS_TLS_ENABLED: false,
        },
        isFastClient,
      );

      // 4 different request executes each a redisClientTask
      const redisClient = await pipe(
        redisClientTask,
        TE.chain(() => redisClientTask),
        TE.chain(() => redisClientTask),
        TE.chain(() => redisClientTask),
      )();

      expect(E.isRight(redisClient)).toBeTruthy();
      if (E.isRight(redisClient)) {
        await redisClient.right.get("test");
        expect(mockGet).toBeCalledWith("test");
      }
      expect(mockCreateClient).toBeCalledTimes(1);
      expect(mockConnect).toBeCalledTimes(1);
    },
  );
});
