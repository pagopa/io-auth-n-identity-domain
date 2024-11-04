import * as redis from "redis";
import * as TE from "fp-ts/TaskEither";
import { toError } from "fp-ts/lib/Either";
import { pipe } from "fp-ts/lib/function";
import * as E from "fp-ts/lib/Either";
import {
  FUNCTION_PREFIX,
  falsyResponseToErrorAsync,
  singleStringReply
} from "../utils/redis/client";
import { Nonce } from "../generated/definitions/models/Nonce";

export const NONCE_PREFIX = "NONCE-";
export const DEFAULT_NONCE_EXPIRE_SEC = 60;

export const prefixer = (key: Nonce): string =>
  `${FUNCTION_PREFIX}${NONCE_PREFIX}${key}`;

export const create = (nonce: Nonce) => (
  redisClient: redis.RedisClientType
): TE.TaskEither<Error, boolean> =>
  pipe(
    TE.tryCatch(
      () =>
        redisClient.setEx(
          prefixer(nonce),
          DEFAULT_NONCE_EXPIRE_SEC,
          "" // An empty string as value, we need only to store a key
        ),
      err =>
        new Error(`Error saving the generated nonce: [${toError(err).message}]`)
    ),
    singleStringReply,
    falsyResponseToErrorAsync(new Error("Error saving the key"))
  );

export const invalidate: (
  nonce: Nonce
) => (
  redis_client: redis.RedisClientType
) => TE.TaskEither<Error, true> = nonce => redis_client =>
  pipe(
    TE.tryCatch(() => redis_client.del(prefixer(nonce)), E.toError),
    TE.chain(
      TE.fromPredicate(
        reply => reply === 1,
        _ => new Error("Unexpected response from redis client: Deleted 0 keys")
      )
    ),
    TE.map(_ => true as const)
  );
