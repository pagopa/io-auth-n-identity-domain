import { GenericError, NonEmptyString } from "@pagopa/hexagonal-core";
import { err, ok, type Result } from "neverthrow";
import { RedisClientType, RedisClusterType } from "redis";

import { SessionBlacklistPort } from "../../domain/ports/outbound/session-blacklist.port.js";
import { PositiveInteger } from "../../domain/value-objects/positive-integer.vo.js";

export const REDIS_BLACKLIST_PREFIX = "BLACKLISTED-";

/**
 * {@link SessionBlacklistPort} implementation storing invalidated session
 * identifiers in Redis, each with its own expiration.
 */
export class RedisSessionBlacklistAdapter implements SessionBlacklistPort {
  constructor(private readonly redis: RedisClientType | RedisClusterType) {}

  async blacklist(
    id: NonEmptyString,
    ttlSeconds: PositiveInteger,
  ): Promise<Result<void, GenericError>> {
    try {
      await this.redis.set(`${REDIS_BLACKLIST_PREFIX}${id}`, "1", {
        expiration: { type: "EX", value: ttlSeconds },
      });
      return ok(undefined);
    } catch (cause) {
      return err(
        new GenericError(`Redis blacklist operation failed: ${cause}`),
      );
    }
  }

  async isBlacklisted(
    id: NonEmptyString,
  ): Promise<Result<boolean, GenericError>> {
    try {
      const count = await this.redis.exists(`${REDIS_BLACKLIST_PREFIX}${id}`);
      return ok(count > 0);
    } catch (cause) {
      return err(
        new GenericError(`Redis isBlacklisted operation failed: ${cause}`),
      );
    }
  }
}
