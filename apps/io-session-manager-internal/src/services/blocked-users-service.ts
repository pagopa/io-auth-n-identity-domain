import * as redisLib from "redis";

import * as RTE from "fp-ts/lib/ReaderTaskEither";
import * as TE from "fp-ts/lib/TaskEither";
import * as AP from "fp-ts/Apply";
import { pipe } from "fp-ts/lib/function";

import { FiscalCode } from "@pagopa/ts-commons/lib/strings";

import { BlockedUsersRedisRepository } from "../repositories/blocked-users-redis";

export type BlockedUsersServiceDeps = {
  fastRedisClientTask: TE.TaskEither<Error, redisLib.RedisClusterType>;
  safeRedisClientTask: TE.TaskEither<Error, redisLib.RedisClusterType>;
  blockedUserRedisRepository: BlockedUsersRedisRepository;
};

const unlockUserSession: (
  fiscalCode: FiscalCode,
) => RTE.ReaderTaskEither<BlockedUsersServiceDeps, Error, true> =
  (fiscalCode) => (deps) =>
    pipe(
      {
        fastClient: deps.fastRedisClientTask,
        safeClient: deps.safeRedisClientTask,
      },
      AP.sequenceS(TE.ApplySeq),
      TE.chain(deps.blockedUserRedisRepository.unsetBlockedUser(fiscalCode)),
      TE.map((_) => true),
    );
export type BlockedUsersService = typeof BlockedUsersService;
export const BlockedUsersService = { unlockUserSession };
