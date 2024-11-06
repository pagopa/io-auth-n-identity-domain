import * as redis from "redis";
import * as TE from "fp-ts/TaskEither";

export type RedisDependency = {
  readonly redisClientTask: TE.TaskEither<Error, redis.RedisClientType>;
};
