import * as redisLib from "redis";
import * as A from "fp-ts/lib/Array";
import * as RTE from "fp-ts/lib/ReaderTaskEither";
import * as ROA from "fp-ts/ReadonlyArray";
import * as TE from "fp-ts/lib/TaskEither";
import * as E from "fp-ts/lib/Either";
import * as O from "fp-ts/lib/Option";
import * as J from "fp-ts/lib/Json";
import * as S from "fp-ts/lib/string";
import * as R from "fp-ts/lib/Record";
import * as B from "fp-ts/boolean";
import { flow, pipe } from "fp-ts/lib/function";
import { FiscalCode } from "@pagopa/ts-commons/lib/strings";
import {
  errorsToReadableMessages,
  readableReportSimplified,
} from "@pagopa/ts-commons/lib/reporters";
import { NonEmptyArray } from "fp-ts/lib/NonEmptyArray";
import {
  LollipopData,
  NullableBackendAssertionRefFromString,
} from "../types/lollipop";
import { LoginTypeEnum } from "../types/fast-login";
import { SessionInfo } from "../generated/definitions/internal/SessionInfo";
import { SessionsList } from "../generated/definitions/internal/SessionsList";
import { AssertionRef } from "../generated/definitions/internal/AssertionRef";
import { SessionToken } from "../types/token";
import { User } from "../types/user";
import { isNumber } from "fp-ts/lib/number";

const lollipopDataPrefix = "KEYS-";
const userSessionsSetKeyPrefix = "USERSESSIONS-";
const sessionKeyPrefix = "SESSION-";
const sessionInfoKeyPrefix = "SESSIONINFO-";
const walletKeyPrefix = "WALLET-";
const myPortalTokenPrefix = "MYPORTAL-";
const bpdTokenPrefix = "BPD-";
const zendeskTokenPrefix = "ZENDESK-";
const fimsTokenPrefix = "FIMS-";

export const sessionNotFoundError = new Error("Session not found");

type FastRedisClientDependency = { fastClient: redisLib.RedisClusterType };
type SafeRedisClientDependency = { safeClient: redisLib.RedisClusterType };
type Dependencies = FastRedisClientDependency & SafeRedisClientDependency;

const getLollipopDataForUser: RTE.ReaderTaskEither<
  SafeRedisClientDependency & { fiscalCode: FiscalCode },
  Error,
  O.Option<LollipopData>
> = ({ safeClient, fiscalCode }) =>
  pipe(
    TE.tryCatch(
      () => safeClient.get(`${lollipopDataPrefix}${fiscalCode}`),
      E.toError,
    ),
    TE.chain(
      flow(
        NullableBackendAssertionRefFromString.decode,
        E.map(
          flow(
            O.fromNullable,
            O.map((storedValue) =>
              LollipopData.is(storedValue)
                ? storedValue
                : // Remap plain string to LollipopData
                  {
                    assertionRef: storedValue,
                    loginType: LoginTypeEnum.LEGACY,
                  },
            ),
          ),
        ),
        E.mapLeft(
          (validationErrors) =>
            new Error(errorsToReadableMessages(validationErrors).join("/")),
        ),
        TE.fromEither,
      ),
    ),
  );

const getLollipopAssertionRefForUser: RTE.ReaderTaskEither<
  SafeRedisClientDependency & { fiscalCode: FiscalCode },
  Error,
  O.Option<AssertionRef>
> = (deps) =>
  pipe(
    deps,
    getLollipopDataForUser,
    TE.map(O.map((data) => data.assertionRef)),
  );

const customMGet: RTE.ReaderTaskEither<
  FastRedisClientDependency & { keys: string[] },
  Error,
  Array<string | null>
> = ({ keys, fastClient }) =>
  pipe(
    keys,
    A.map((singleKey) =>
      TE.tryCatch(() => fastClient.get(singleKey), E.toError),
    ),
    A.sequence(TE.ApplicativePar),
  );

const parseUserSessionList = (userSessionTokensResult: ReadonlyArray<string>) =>
  userSessionTokensResult.reduce(
    (prev: SessionsList, _) =>
      pipe(
        E.parseJSON(_, E.toError),
        E.chain((data) =>
          pipe(
            SessionInfo.decode(data),
            E.mapLeft(
              (err) => new Error(errorsToReadableMessages(err).join("/")),
            ),
          ),
        ),
        E.fold(
          (_err) => prev,
          (sessionInfo) => ({
            sessions: [...prev.sessions, sessionInfo],
          }),
        ),
      ),
    { sessions: [] } as SessionsList,
  );

export const userHasActiveSessionsLegacy: RTE.ReaderTaskEither<
  FastRedisClientDependency & { fiscalCode: FiscalCode },
  Error,
  boolean
> = ({ fastClient, fiscalCode }) =>
  pipe(
    readSessionInfoKeys({ fiscalCode, fastClient }),
    TE.fold(
      (err) =>
        pipe(
          err === sessionNotFoundError,
          B.fold(
            () => TE.left(err),
            () => TE.right(false as const),
          ),
        ),
      (userSessions) =>
        pipe(
          customMGet({ fastClient, keys: userSessions as string[] }),
          TE.map((keys) =>
            parseUserSessionList(
              keys.filter<string>((key): key is string => key !== null),
            ).sessions.map(
              (session) => `${sessionKeyPrefix}${session.sessionToken}`,
            ),
          ),
          TE.chain((sessionsList) =>
            pipe(
              sessionsList.length !== 0,
              B.fold(
                () => TE.right(false as const),
                () =>
                  pipe(
                    customMGet({ fastClient, keys: sessionsList }),
                    // Skipping null values from the array
                    TE.map(A.filter((key): key is string => key !== null)),
                    TE.map((filteredList) => filteredList.length > 0),
                  ),
              ),
            ),
          ),
        ),
    ),
  );

const userHasActiveSessionsOrLV: RTE.ReaderTaskEither<
  Dependencies & { fiscalCode: FiscalCode },
  Error,
  boolean
> = (deps) =>
  pipe(
    getLollipopDataForUser(deps),
    TE.chain(
      flow(
        O.map((data) =>
          pipe(
            data.loginType === LoginTypeEnum.LV,
            B.fold(
              // if login type is not LV, check for active user sessions
              () => userHasActiveSessionsLegacy(deps),
              // if login type is LV, return true
              () => TE.of<Error, true>(true),
            ),
          ),
        ),
        // if no LollipopData was found, return false
        O.getOrElseW(() => TE.of<Error, false>(false)),
      ),
    ),
  );

const readSessionInfoKeys: RTE.ReaderTaskEither<
  FastRedisClientDependency & { fiscalCode: FiscalCode },
  Error,
  ReadonlyArray<string>
> = (deps) =>
  pipe(
    TE.tryCatch(
      () =>
        deps.fastClient.sMembers(
          `${userSessionsSetKeyPrefix}${deps.fiscalCode}`,
        ),
      E.toError,
    ),
    TE.chain(
      TE.fromPredicate(
        (res): res is NonEmptyArray<string> =>
          Array.isArray(res) && res.length > 0,
        () => sessionNotFoundError,
      ),
    ),
  );

const loadSessionBySessionToken: RTE.ReaderTaskEither<
  FastRedisClientDependency & { token: SessionToken },
  Error,
  User
> = (deps) =>
  pipe(
    TE.tryCatch(
      () => deps.fastClient.get(`${sessionKeyPrefix}${deps.token}`),
      E.toError,
    ),
    TE.chain(
      flow(
        O.fromNullable,
        E.fromOption(() => sessionNotFoundError),
        E.chain(
          flow(
            J.parse,
            E.mapLeft(E.toError),
            E.chain(
              flow(
                User.decode,
                E.mapLeft((err) => new Error(readableReportSimplified(err))),
              ),
            ),
          ),
        ),
        TE.fromEither,
      ),
    ),
  );

const getUserTokens = (
  user: User,
): Record<string, { readonly prefix: string; readonly value: string }> => ({
  session_info: {
    prefix: sessionInfoKeyPrefix,
    value: user.session_token,
  },
  session_token: {
    prefix: sessionKeyPrefix,
    value: user.session_token,
  },
  wallet_token: {
    prefix: walletKeyPrefix,
    value: user.wallet_token,
  },
  bpd_token: {
    prefix: bpdTokenPrefix,
    value: user.bpd_token,
  },
  fims_token: {
    prefix: fimsTokenPrefix,
    value: user.fims_token,
  },
  myportal_token: {
    prefix: myPortalTokenPrefix,
    value: user.myportal_token,
  },
  zendesk_token: {
    prefix: zendeskTokenPrefix,
    value: user.zendesk_token,
  },
});

const deleteUser: RTE.ReaderTaskEither<
  FastRedisClientDependency & { user: User },
  Error,
  true
> = (deps) =>
  pipe(
    getUserTokens(deps.user),
    R.collect(S.Ord)((_, { prefix, value }) => `${prefix}${value}`),
    (tokens) =>
      pipe(
        tokens,
        ROA.map((singleToken) =>
          TE.tryCatch(() => deps.fastClient.del(singleToken), E.toError),
        ),
        ROA.sequence(TE.ApplicativeSeq),
        TE.map(ROA.reduce(0, (current, next) => current + next)),
        integerReplyAsync(tokens.length),
        falsyResponseToErrorAsync(
          new Error(
            "Unexpected response from redis client deleting user tokens.",
          ),
        ),
        TE.mapLeft(
          (err) =>
            new Error(`value [${err.message}] at RedisSessionStorage.del`),
        ),
        TE.chainFirstW((_) => {
          // Remove SESSIONINFO reference from USERSESSIONS Set
          // this operation is executed in background and doesn't compromise
          // the logout process.
          deps.fastClient
            .sRem(
              `${userSessionsSetKeyPrefix}${deps.user.fiscal_code}`,
              `${sessionInfoKeyPrefix}${deps.user.session_token}`,
            )
            .catch((_) => void 0);
          return TE.of(true);
        }),
      ),
  );

const delSingleSession: RTE.ReaderTaskEither<
  FastRedisClientDependency & { token: SessionToken },
  Error,
  boolean
> = (deps) =>
  pipe(
    loadSessionBySessionToken(deps),
    TE.chain((user) => deleteUser({ ...deps, user })),
    // as it's a delete, if the query fails for a NotFound error, it might be considered a success
    TE.orElse((err) =>
      err === sessionNotFoundError ? TE.right(true) : TE.left(err),
    ),
  );

const delSessionsSet: RTE.ReaderTaskEither<
  FastRedisClientDependency & { fiscalCode: FiscalCode },
  Error,
  true
> = (deps) =>
  pipe(
    TE.tryCatch(
      () =>
        deps.fastClient.del(`${userSessionsSetKeyPrefix}${deps.fiscalCode}`),
      E.toError,
    ),
    TE.map((_) => true),
  );

const delLollipopDataForUser: RTE.ReaderTaskEither<
  FastRedisClientDependency & { fiscalCode: FiscalCode },
  Error,
  boolean
> = (deps) =>
  pipe(
    TE.tryCatch(
      () => deps.fastClient.del(`${lollipopDataPrefix}${deps.fiscalCode}`),
      E.toError,
    ),
    integerReplyAsync(),
  );

const delUserAllSessions: RTE.ReaderTaskEither<
  FastRedisClientDependency & { fiscalCode: FiscalCode },
  Error,
  true
> = (deps) => {
  const delEverySession = (
    sessionTokens: ReadonlyArray<SessionToken>,
  ): TE.TaskEither<Error, boolean> =>
    pipe(
      A.sequence(TE.ApplicativePar)<Error, boolean>(
        sessionTokens.map((sessionToken) =>
          pipe(
            TE.fromEither(
              pipe(
                sessionToken,
                SessionToken.decode,
                E.mapLeft(() => new Error("Error decoding token")),
              ),
            ),
            TE.chain((token: SessionToken) =>
              delSingleSession({ ...deps, token }),
            ),
          ),
        ),
      ),
      TE.map(() => true as const),
    );

  return pipe(
    deps,
    readSessionInfoKeys,
    TE.fold(
      // as we're deleting stuff, a NotFound error can be considered as a success
      (error) =>
        error === sessionNotFoundError ? TE.of(true) : TE.left(error),
      (sessionInfoKeys) =>
        delEverySession(
          sessionInfoKeys.map(
            (sessionInfoKey) =>
              sessionInfoKey.replace(sessionInfoKeyPrefix, "") as SessionToken,
          ),
        ),
    ),
    TE.chain(() => delSessionsSet(deps)),
  );
};

// -----------------------
// Utilities
// -----------------------

export const integerReplyAsync =
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

export const falsyResponseToErrorAsync =
  (error: Error) =>
  (response: TE.TaskEither<Error, boolean>): TE.TaskEither<Error, true> =>
    pipe(
      response,
      TE.chain((_) => (_ ? TE.right(_) : TE.left(error))),
    );

// -----------------------
// Exports
// -----------------------

export type RedisRepository = typeof RedisRepository;
export const RedisRepository = {
  userHasActiveSessionsOrLV,
  getLollipopAssertionRefForUser,
  delLollipopDataForUser,
  delUserAllSessions,
};
