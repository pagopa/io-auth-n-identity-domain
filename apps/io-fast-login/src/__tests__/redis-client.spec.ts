import { describe, expect, it, vi } from "vitest";
const { mockConnect, mockGet } = vi.hoisted(() => {
  return {
    mockConnect: vi.fn().mockResolvedValue({}),
    mockGet: vi.fn().mockResolvedValue("value"),
  }
})
const { mockCreateClient } = vi.hoisted(() => {
  return {
    mockCreateClient: vi.fn().mockImplementation(() => ({
      connect: mockConnect,
      on: vi.fn(),
      get: mockGet,
    }))
  }
})
vi.mock("redis", () => ({
  createClient: mockCreateClient,
}));

import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { CreateRedisClientSingleton } from "../utils/redis/client";
import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";
import * as E from "fp-ts/Either";

describe("redisClient creation on startup", () => {
  it("only one time the redis client is created", async () => {
    const redisClientTask = CreateRedisClientSingleton({
      REDIS_URL: "redis" as NonEmptyString,
      REDIS_TLS_ENABLED: false
    });

    // 4 different request executes each a redisClientTask
    const redisClient = await pipe(
      redisClientTask,
      TE.chain(() => redisClientTask),
      TE.chain(() => redisClientTask),
      TE.chain(() => redisClientTask)
    )();

    expect(E.isRight(redisClient)).toBeTruthy();
    if (E.isRight(redisClient)) {
      redisClient.right.get("test");
      expect(mockGet).toBeCalledWith("test");
    }
    expect(mockCreateClient).toBeCalledTimes(1);
    expect(mockConnect).toBeCalledTimes(1);
  });
});
