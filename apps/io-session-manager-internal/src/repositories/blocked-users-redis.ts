import * as redisLib from "redis";

import * as RTE from "fp-ts/lib/ReaderTaskEither";
import * as TE from "fp-ts/lib/TaskEither";
import * as E from "fp-ts/lib/Either";
import { pipe } from "fp-ts/lib/function";

import { FiscalCode } from "@pagopa/ts-commons/lib/strings";

import { falsyResponseToErrorAsync, integerReplyAsync } from "./redis";

type FastRedisClientDependency = { fastClient: redisLib.RedisClusterType };
type SafeRedisClientDependency = { safeClient: redisLib.RedisClusterType };
type Dependencies = FastRedisClientDependency & SafeRedisClientDependency;

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

// -----------------------
// Exports
// -----------------------

export type BlockedUserRedisDependencies = Dependencies;
export type BlockedUsersRedisRepository = typeof BlockedUsersRedisRepository;
export const BlockedUsersRedisRepository = { unsetBlockedUser };
