import * as redisLib from "redis";

import * as RTE from "fp-ts/lib/ReaderTaskEither";
import * as TE from "fp-ts/lib/TaskEither";
import * as E from "fp-ts/lib/Either";
import { pipe } from "fp-ts/lib/function";

import { FiscalCode } from "@pagopa/ts-commons/lib/strings";

import { falsyResponseToErrorAsync, integerReplyAsync } from "./redis";

type FastRedisClientDependency = { fastClient: redisLib.RedisClusterType };
type Dependencies = FastRedisClientDependency;

const blockedUserSetKey = "BLOCKEDUSERS";

// -----------------------
// Public functions
// -----------------------

const unsetBlockedUser: (
  fiscalCode: FiscalCode,
) => RTE.ReaderTaskEither<Dependencies, Error, boolean> =
  (fiscalCode) =>
  ({ fastClient }) =>
    pipe(
      TE.tryCatch(
        () => fastClient.sRem(blockedUserSetKey, fiscalCode),
        E.toError,
      ),
      integerReplyAsync(1),
      falsyResponseToErrorAsync(
        new Error(
          "Unexpected response from redis client deleting blockedUserKey",
        ),
      ),
    );

const setBlockedUser: (
  fiscalCode: FiscalCode,
) => RTE.ReaderTaskEither<Dependencies, Error, true> =
  (fiscalCode) =>
  ({ fastClient }) =>
    pipe(
      TE.tryCatch(
        () => fastClient.sAdd(blockedUserSetKey, fiscalCode),
        E.toError,
      ),
      TE.map<number, true>((_) => true),
    );

// -----------------------
// Exports
// -----------------------

export type BlockedUserRedisDependencies = Dependencies;
export type BlockedUsersRedisRepository = typeof BlockedUsersRedisRepository;
export const BlockedUsersRedisRepository = { setBlockedUser, unsetBlockedUser };
