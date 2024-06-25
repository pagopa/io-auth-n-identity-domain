import * as TE from "fp-ts/TaskEither";
import * as E from "fp-ts/Either";
import * as RTE from "fp-ts/ReaderTaskEither";

import {
  IResponseSuccessJson,
  ResponseSuccessJson,
} from "@pagopa/ts-commons/lib/responses";
import { pipe } from "fp-ts/lib/function";
import { BackendVersion } from "../generated/public/BackendVersion";
import { getCurrentBackendVersion } from "../utils/package";
import { RedisRepo } from "../repositories";
import { RedisClientMode } from "../types/redis";
import { log } from "../utils/logger";

export const healthcheck: RTE.ReaderTaskEither<
  RedisRepo.RedisRepositoryDeps,
  Error,
  IResponseSuccessJson<BackendVersion>
> = (deps) =>
  pipe(
    TE.tryCatch(() => {
      const redisCommand = deps.redisClientSelector
        .selectOne(RedisClientMode.SAFE)
        .sendCommand("INFO", true, ["CLUSTER", "INFO"]);
      return new Promise((resolve, reject) => {
        redisCommand.then(resolve).catch(reject);
        setTimeout(() => {
          reject(new Error("The redis command take too much time"));
        }, 5000);
      }) as typeof redisCommand;
    }, E.toError),
    TE.chain(
      TE.fromPredicate(
        (clusterInfo) => {
          log.info("[CLUSTER INFO] %s", clusterInfo);
          return /^cluster_state:ok$/m.test(String(clusterInfo)) === true;
        },
        () => new Error("Redis Cluster bad status"),
      ),
    ),
    TE.map((_) =>
      ResponseSuccessJson(
        BackendVersion.encode({ version: getCurrentBackendVersion() }),
      ),
    ),
  );
