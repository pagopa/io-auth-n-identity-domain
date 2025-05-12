import * as redisLib from "redis";

import * as RTE from "fp-ts/lib/ReaderTaskEither";
import * as TE from "fp-ts/lib/TaskEither";
import * as E from "fp-ts/lib/Either";
import { pipe } from "fp-ts/lib/function";
import { isNumber } from "fp-ts/lib/number";

import { FiscalCode } from "@pagopa/ts-commons/lib/strings";

type FastRedisClientDependency = { fastClient: redisLib.RedisClusterType };
type SafeRedisClientDependency = { safeClient: redisLib.RedisClusterType };
type Dependencies = FastRedisClientDependency & SafeRedisClientDependency;

const blockedUserSetKey = "BLOCKEDUSERS";

// -----------------------
// Private functions
// -----------------------

const integerReplyAsync =
  (expectedReply?: number) =>
  (command: TE.TaskEither<Error, unknown>): TE.TaskEither<Error, boolean> =>
    pipe(
      command,
      TE.chain((reply) => {
        if (expectedReply !== undefined && expectedReply !== reply) {
          return TE.right(false);
        }
        return TE.right(isNumber(reply));
      }),
    );

const falsyResponseToErrorAsync =
  (error: Error) =>
  (response: TE.TaskEither<Error, boolean>): TE.TaskEither<Error, true> =>
    pipe(
      response,
      TE.chain((_) => (_ ? TE.right(_) : TE.left(error))),
    );

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
