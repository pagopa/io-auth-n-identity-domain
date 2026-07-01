import { ResultAsync, ok, err } from "neverthrow";
import { RedisClientType } from "redis";
import { AusiliarDataI } from "../../domain/ports/outbound/ausiliarData.js";
import { GenericError } from "@pagopa/hexagonal-core";
import { LoginAusiliarData } from "../../domain/entities/login.js";

export const makeRedisAusiliarDataAdapter = (
  redisClient: RedisClientType,
): AusiliarDataI => {
  return {
    save: (key, obj) => {
      return ResultAsync.fromPromise(
        redisClient.set(key, JSON.stringify(obj)),
        (error) => {
          const msg =
            error instanceof Error ? error.message : "Unknown Redis error";
          return new GenericError(`Redis save operation failed: ${msg}`);
        },
      ).map(() => undefined);
    },

    retrieve: (key: string) => {
      return ResultAsync.fromPromise(redisClient.get(key), (error) => {
        const msg =
          error instanceof Error ? error.message : "Unknown Redis error";
        return new GenericError(`Redis retrieve operation failed: ${msg}`);
      }).andThen((data) => {
        if (!data) {
          return ok(undefined);
        }
        try {
          const deserializedData = JSON.parse(data);

          const parseResult = LoginAusiliarData.safeParse(deserializedData);
          if (!parseResult.success) {
            return err(
              new GenericError(
                `Couldn't parse retrieved data: ${parseResult.error.message}`,
              ),
            );
          }

          return ok(parseResult.data);
        } catch {
          return err(new GenericError("Couldn't parse data"));
        }
      });
    },
  };
};
