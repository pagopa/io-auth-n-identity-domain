import { GenericError, NotFoundError } from "@pagopa/hexagonal-core";
import { RedisObjectWrapper } from "@pagopa/redis/object-wrapper";
import { err, ok, type Result } from "neverthrow";
import { AusiliarDataPort } from "../../domain/ports/outbound/ausiliar-data.port.js";
import {
  LoginAusiliarData,
  LoginAusiliarDataSchema,
} from "../../domain/value-objects/login.vo.js";
import { RedisClientType, RedisClusterType } from "redis";

export const REDIS_AUSILIAR_DATA_PREFIX = "RESERVE-";

const EXPECTED_PING_REPLY = "PONG";

export class AusiliarDataRedisAdapter implements AusiliarDataPort {
  constructor(
    private readonly redis: RedisObjectWrapper<
      typeof LoginAusiliarDataSchema,
      RedisClientType | RedisClusterType
    >,
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
    obj: LoginAusiliarData,
  ): Promise<Result<undefined, GenericError>> {
    const result = await this.redis.save(
      `${REDIS_AUSILIAR_DATA_PREFIX}${id}`,
      obj,
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
  ): Promise<Result<LoginAusiliarData, GenericError | NotFoundError>> {
    const result = await this.redis.get(`${REDIS_AUSILIAR_DATA_PREFIX}${id}`);
    if (result.isErr()) {
      return err(
        new GenericError(
          `Redis retrieve operation failed: ${result.error.message}`,
        ),
      );
    }
    if (result.value === undefined) {
      return err(
        new NotFoundError("LoginAusiliarData", "LoginAusiliarData Not Found"),
      );
    }
    return ok(result.value);
  }
}
