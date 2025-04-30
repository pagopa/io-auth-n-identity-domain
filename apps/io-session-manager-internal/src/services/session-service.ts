import * as RTE from "fp-ts/lib/ReaderTaskEither";
import * as TE from "fp-ts/lib/TaskEither";
import * as AP from "fp-ts/Apply";
import * as redisLib from "redis";
import { pipe } from "fp-ts/lib/function";
import { FiscalCode } from "@pagopa/ts-commons/lib/strings";
import { RedisRepository } from "../repositories/redis";
import { UserSessionInfo } from "../generated/definitions/internal/UserSessionInfo";

export type SessionServiceDeps = {
  FastRedisClientTask: TE.TaskEither<Error, redisLib.RedisClusterType>;
  SafeRedisClientTask: TE.TaskEither<Error, redisLib.RedisClusterType>;
  RedisRepository: RedisRepository;
};

const getUserSession: (
  fiscalCode: FiscalCode,
) => RTE.ReaderTaskEither<SessionServiceDeps, Error, UserSessionInfo> =
  (fiscalCode) => (deps) =>
    pipe(
      {
        fastClient: deps.FastRedisClientTask,
        safeClient: deps.SafeRedisClientTask,
      },
      AP.sequenceS(TE.ApplySeq),
      TE.chain(({ fastClient, safeClient }) =>
        pipe(
          deps.RedisRepository.userHasActiveSessionsOrLV({
            fastClient,
            safeClient,
            fiscalCode,
          }),
          TE.map((active) => UserSessionInfo.encode({ active })),
        ),
      ),
    );

export type SessionService = typeof SessionService;
export const SessionService = { getUserSession };
