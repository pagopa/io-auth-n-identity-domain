import { GenericError, NotFoundError } from "@pagopa/hexagonal-core";
import { RedisObjectWrapper } from "@pagopa/redis/object-wrapper";
import { err, ok, type Result } from "neverthrow";
import { RedisClientType, RedisClusterType } from "redis";

import { AuxiliaryDataPort } from "../../domain/ports/outbound/auxiliary-data.port.js";
import {
  LoginAuxiliaryData,
  LoginAuxiliaryDataSchema,
} from "../../domain/value-objects/login.vo.js";
import { PositiveInteger } from "../../domain/value-objects/positive-integer.vo.js";

export const REDIS_AUXILIARY_DATA_PREFIX = "RESERVE-";

const EXPECTED_PING_REPLY = "PONG";

export class AuxiliaryDataRedisAdapter implements AuxiliaryDataPort {
  constructor(
    private readonly redis: RedisObjectWrapper<
      typeof LoginAuxiliaryDataSchema,
      RedisClientType | RedisClusterType
    >,
    private readonly ttlSeconds: PositiveInteger,
  ) {}

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

  async save(
    id: string,
    obj: LoginAuxiliaryData,
  ): Promise<Result<undefined, GenericError>> {
    const result = await this.redis.save(
      `${REDIS_AUXILIARY_DATA_PREFIX}${id}`,
      obj,
      { expiration: { type: "EX", value: this.ttlSeconds } },
    );
    if (result.isErr()) {
      return err(
        new GenericError(
          `Redis save operation failed: ${result.error.message}`,
        ),
      );
    }
    return ok(undefined);
  }

  async retrieve(
    id: string,
  ): Promise<Result<LoginAuxiliaryData, GenericError | NotFoundError>> {
    const result = await this.redis.getAndDelete(
      `${REDIS_AUXILIARY_DATA_PREFIX}${id}`,
    );
    if (result.isErr()) {
      return err(
        new GenericError(
          `Redis retrieve operation failed: ${result.error.message}`,
        ),
      );
    }
    if (result.value === undefined) {
      return err(
        new NotFoundError("LoginAuxiliaryData", "LoginAuxiliaryData Not Found"),
      );
    }
    return ok(result.value);
  }
}
