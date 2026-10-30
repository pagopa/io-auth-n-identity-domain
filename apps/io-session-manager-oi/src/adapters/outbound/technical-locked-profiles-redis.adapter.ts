import {
  FiscalCode,
  FiscalCodeSchema,
  GenericError,
  ValidationError,
} from "@pagopa/hexagonal-core";
import { RedisError } from "@pagopa/redis";
import { RedisSetWrapper } from "@pagopa/redis/set-wrapper";
import { Result, err, ok } from "neverthrow";
import { RedisClientType, RedisClusterType } from "redis";

import { TechnicalLockedProfilesPort } from "../../domain/ports/outbound/technical-locked-profiles.port.js";
import { HealthCheckOutboundPort } from "@pagopa/io-auth-n-identity-domain";

export const BLOCKED_USERS_SET_KEY = "BLOCKEDUSERS";

/**
 * The expected reply to a Redis `PING` command with no argument.
 */
const EXPECTED_PING_REPLY = "PONG";

export class TechnicalLockedProfilesRedisAdapter
  implements TechnicalLockedProfilesPort, HealthCheckOutboundPort
{
  constructor(
    private readonly redis: RedisSetWrapper<
      typeof FiscalCodeSchema,
      RedisClientType | RedisClusterType
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

  async isLocked(
    fiscalCode: FiscalCode,
  ): Promise<Result<boolean, RedisError | GenericError>> {
    const result = await this.redis.isMember(BLOCKED_USERS_SET_KEY, fiscalCode);
    if (result.isErr()) {
      return err(
        new GenericError(`Redis isLocked failed: ${result.error.message}`),
      );
    }
    return ok(result.value);
  }
}
