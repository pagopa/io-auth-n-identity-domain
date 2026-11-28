import { NonEmptyString } from "@pagopa/hexagonal-core";
import { RedisClientType } from "redis";
import { describe, expect, it, vi } from "vitest";

import { PositiveInteger } from "../../../domain/value-objects/positive-integer.vo.js";
import {
  REDIS_BLACKLIST_PREFIX,
  RedisSessionBlacklistAdapter,
} from "../redis-session-blacklist.adapter.js";

const anId = "a-jti" as NonEmptyString;
const aTtl = 120 as PositiveInteger;

const setup = () => {
  const redis = { exists: vi.fn(), setEx: vi.fn() };
  const adapter = new RedisSessionBlacklistAdapter(
    redis as unknown as RedisClientType,
  );
  return { adapter, redis };
};

describe("RedisSessionBlacklistAdapter", () => {
  describe("blacklist", () => {
    it("stores the prefixed id with the given expiration", async () => {
      const { adapter, redis } = setup();
      redis.setEx.mockResolvedValue("OK");

      const result = await adapter.blacklist(anId, aTtl);

      expect(result.isOk()).toBe(true);
      expect(redis.setEx).toHaveBeenCalledWith(
        `${REDIS_BLACKLIST_PREFIX}${anId}`,
        aTtl,
        "1",
      );
    });

    it("returns a GenericError when Redis fails", async () => {
      const { adapter, redis } = setup();
      redis.setEx.mockRejectedValue(new Error("boom"));

      const error = (await adapter.blacklist(anId, aTtl))._unsafeUnwrapErr();

      expect(error.kind).toBe("GenericError");
    });
  });

  describe("isBlacklisted", () => {
    it.each([
      [1, true],
      [0, false],
    ])("maps EXISTS reply %i to %s", async (reply, expected) => {
      const { adapter, redis } = setup();
      redis.exists.mockResolvedValue(reply);

      expect((await adapter.isBlacklisted(anId))._unsafeUnwrap()).toBe(
        expected,
      );
      expect(redis.exists).toHaveBeenCalledWith(
        `${REDIS_BLACKLIST_PREFIX}${anId}`,
      );
    });

    it("returns a GenericError when Redis fails", async () => {
      const { adapter, redis } = setup();
      redis.exists.mockRejectedValue(new Error("boom"));

      const error = (await adapter.isBlacklisted(anId))._unsafeUnwrapErr();

      expect(error.kind).toBe("GenericError");
    });
  });
});
