import {
  BaseError,
  FiscalCode,
  FiscalCodeSchema,
  GenericError,
} from "@pagopa/hexagonal-core";
import { RedisNodeClient, RedisSetWrapper } from "@pagopa/redis/set-wrapper";
import { Result, err, ok } from "neverthrow";

import { BlockedUsersPort } from "../../domain/ports/outbound/blocked-users.port.js";

export const BLOCKED_USERS_SET_KEY = "BLOCKEDUSERS";

/**
 * The expected reply to a Redis `PING` command with no argument.
 */
const EXPECTED_PING_REPLY = "PONG";

export class BlockedUsersRedisAdapter implements BlockedUsersPort {
  constructor(
    private readonly redis: RedisSetWrapper<
      typeof FiscalCodeSchema,
      RedisNodeClient
    >,
  ) {}

  /**
   * Probes the underlying Redis instance with `PING` — the canonical
   * health probe for a single-node Redis. A `PONG` reply proves that
   * the socket is up, authentication has succeeded, and the server
   * is accepting commands.
   */
  async healthcheck(): Promise<Result<void, GenericError>> {
    try {
      const reply = await this.redis.getClient().ping();
      if (reply !== EXPECTED_PING_REPLY) {
        return err(
          new GenericError(
            `Redis healthcheck failed: unexpected PING reply "${reply}"`,
          ),
        );
      }
      return ok(undefined);
    } catch (cause) {
      const error = cause instanceof Error ? cause : new Error(String(cause));
      return err(
        new GenericError(`Redis healthcheck failed: ${error.message}`),
      );
    }
  }

  isBlocked(fiscalCode: FiscalCode): Promise<Result<boolean, BaseError>> {
    return this.redis.isMember(BLOCKED_USERS_SET_KEY, fiscalCode);
  }
}
