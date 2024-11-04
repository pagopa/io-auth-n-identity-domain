import {
  HealthCheck,
  toHealthProblems
} from "@pagopa/io-functions-commons/dist/src/utils/healthcheck";
import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";
import { RedisDependency } from "./dependency";

export type RedisDBProblemSource = "Redis";

export const makeRedisDBHealthCheck = ({
  redisClientTask
}: RedisDependency): HealthCheck<RedisDBProblemSource> =>
  pipe(
    redisClientTask,
    TE.chainW(redisClient =>
      TE.tryCatch(
        () => redisClient.ping(),
        () => new Error("Error executing the ping to redis")
      )
    ),
    TE.mapLeft(toHealthProblems("Redis")),
    TE.map(() => true)
  );
