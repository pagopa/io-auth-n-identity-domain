import { isArray } from "util";
import * as E from "fp-ts/Either";
import * as O from "fp-ts/Option";
import { flow, identity, pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";
import * as R from "fp-ts/lib/Record";
import * as S from "fp-ts/lib/string";
import * as A from "fp-ts/Array";
import * as T from "fp-ts/Task";
import { errorsToReadableMessages } from "@pagopa/ts-commons/lib/reporters";
import { FiscalCode } from "@pagopa/ts-commons/lib/strings";
import { isNumber } from "fp-ts/lib/number";
import { NonEmptyArray } from "fp-ts/lib/NonEmptyArray";
import * as ROA from "fp-ts/ReadonlyArray";
import * as RTE from "fp-ts/ReaderTaskEither";
import { Second } from "@pagopa/ts-commons/lib/units";
import {
  BPDToken,
  FIMSToken,
  MyPortalToken,
  SessionToken,
  WalletToken,
  ZendeskToken,
} from "../types/token";
import { User } from "../types/user";
import { RedisRepo } from "../repositories";
import { blockedUserSetKey, lollipopDataPrefix } from "../repositories/redis";
import {
  LollipopData,
  LollipopDataFromString,
  NullableBackendAssertionRefFromString,
} from "../types/assertion-ref";
import { LoginTypeEnum } from "../types/fast-login";
import { AssertionRef as BackendAssertionRef } from "../generated/backend/AssertionRef";
import { SessionInfo } from "../generated/backend/SessionInfo";
import { log } from "../utils/logger";
import { multipleErrorsFormatter } from "../utils/errors";
import { RedisClientMode, RedisClientSelectorType } from "../types/redis";

// LolliPoP protocol configuration params
export const DEFAULT_LOLLIPOP_ASSERTION_REF_DURATION = (3600 *
  24 *
  365 *
  2) as Second; // 2y default assertionRef duration on redis cache

const parseUser = (value: string): E.Either<Error, User> =>
  pipe(
    E.parseJSON(value, E.toError),
    E.chain(
      flow(
        User.decode,
        E.mapLeft((err) => new Error(errorsToReadableMessages(err).join("/"))),
      ),
    ),
  );

/**
 * Read the user data related to a session token and parse it when is present.
 * @param deps the Redis repository and the session token
 * @returns The parsed used data object or an error.
 */
const loadSessionBySessionToken: RTE.ReaderTaskEither<
  RedisRepo.RedisRepositoryDeps & { token: SessionToken },
  Error,
  User
> = (deps) =>
  pipe(
    TE.tryCatch(
      () =>
        deps.redisClientSelector
          .selectOne(RedisClientMode.FAST)
          .get(`${RedisRepo.sessionKeyPrefix}${deps.token}`),
      E.toError,
    ),
    TE.chain(
      flow(
        O.fromNullable,
        E.fromOption(() => RedisRepo.sessionNotFoundError),
        E.chain(parseUser),
        TE.fromEither,
      ),
    ),
  );

/**
 * Returns an RTE that returns the User session based on this token.
 * @param prefix
 * @returns The parsed used data object or an error.
 */
export const loadSessionByToken: (
  prefix:
    | typeof RedisRepo.walletKeyPrefix
    | typeof RedisRepo.myPortalTokenPrefix
    | typeof RedisRepo.bpdTokenPrefix
    | typeof RedisRepo.zendeskTokenPrefix
    | typeof RedisRepo.fimsTokenPrefix,
  token: WalletToken | MyPortalToken | BPDToken | ZendeskToken | FIMSToken,
) => RTE.ReaderTaskEither<RedisRepo.RedisRepositoryDeps, Error, User> =
  (prefix, token) => (deps) =>
    pipe(
      TE.tryCatch(
        () =>
          deps.redisClientSelector
            .selectOne(RedisClientMode.FAST)
            .get(`${prefix}${token}`),
        E.toError,
      ),
      TE.chain(
        flow(
          O.fromNullable,
          TE.fromOption(() => RedisRepo.sessionNotFoundError),
        ),
      ),
      TE.chain((value) =>
        loadSessionBySessionToken({ ...deps, token: value as SessionToken }),
      ),
    );

/**
 * Return an optional `User` object related to a `SessionToken`
 * @param deps the required dependencies are the Redis repository and the session token
 * @returns an optional User if the session exists / not exist or an error otherwise
 */
export const getBySessionToken: RTE.ReaderTaskEither<
  RedisRepo.RedisRepositoryDeps & { token: SessionToken },
  Error,
  O.Option<User>
> = (deps) =>
  pipe(
    deps,
    loadSessionBySessionToken,
    TE.foldW(
      (err) =>
        err === RedisRepo.sessionNotFoundError
          ? TE.right<Error, O.Option<User>>(O.none)
          : TE.left<Error, O.Option<User>>(err),
      (_) => TE.right<Error, O.Option<User>>(O.some(_)),
    ),
  );

export const delLollipopDataForUser: RTE.ReaderTaskEither<
  RedisRepo.RedisRepositoryDeps & { fiscalCode: FiscalCode },
  Error,
  boolean
> = (deps) =>
  pipe(
    TE.tryCatch(
      () =>
        deps.redisClientSelector
          .selectOne(RedisClientMode.FAST)
          .del(`${lollipopDataPrefix}${deps.fiscalCode}`),
      E.toError,
    ),
    integerReplyAsync(),
  );

/**
 * Returns an optional `AssertionRef` related to an user fical code.
 * @param deps the required dependencies are the Redis repository and the user fiscal code
 * @returns An optional assertion ref or error
 */
export const getLollipopAssertionRefForUser: RTE.ReaderTaskEither<
  RedisRepo.RedisRepositoryDeps & { fiscalCode: FiscalCode },
  Error,
  O.Option<BackendAssertionRef>
> = (deps) =>
  pipe(
    deps,
    getLollipopDataForUser,
    TE.map(O.map((data) => data.assertionRef)),
  );

/**
 * Returns an optional `LollipopData` with assertion ref and login type
 * related to an user fical code.
 * @param deps the required dependencies are the Redis repository and the user fiscal code
 * @returns An optional LollipopData or error
 */
const getLollipopDataForUser: RTE.ReaderTaskEither<
  RedisRepo.RedisRepositoryDeps & { fiscalCode: FiscalCode },
  Error,
  O.Option<LollipopData>
> = (deps) =>
  pipe(
    TE.tryCatch(
      () =>
        deps.redisClientSelector
          .selectOne(RedisClientMode.SAFE)
          .get(`${RedisRepo.lollipopDataPrefix}${deps.fiscalCode}`),
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

export const delLollipopDataForUser: RTE.ReaderTaskEither<
  RedisRepo.RedisRepositoryDeps & { fiscalCode: FiscalCode },
  Error,
  boolean
> = (deps) =>
  pipe(
    TE.tryCatch(
      () =>
        deps.redisClientSelector
          .selectOne(RedisClientMode.FAST)
          .del(`${lollipopDataPrefix}${deps.fiscalCode}`),
      E.toError,
    ),
    integerReplyAsync(),
  );

export const setLollipopAssertionRefForUser: (
  user: User,
  assertionRef: BackendAssertionRef,
  expireAssertionRefSec?: Second,
) => RTE.ReaderTaskEither<RedisRepo.RedisRepositoryDeps, Error, boolean> =
  (
    user,
    assertionRef,
    expireAssertionRefSec = DEFAULT_LOLLIPOP_ASSERTION_REF_DURATION,
  ) =>
  (deps) =>
    pipe(
      TE.tryCatch(
        () =>
          deps.redisClientSelector
            .selectOne(RedisClientMode.FAST)
            .setEx(
              `${lollipopDataPrefix}${user.fiscal_code}`,
              expireAssertionRefSec,
              assertionRef,
            ),
        E.toError,
      ),
      singleStringReplyAsync,
      falsyResponseToErrorAsync(new Error("Error setting user key")),
    );

export const setLollipopDataForUser: (
  user: User,
  data: LollipopData,
  expireAssertionRefSec?: Second,
) => RTE.ReaderTaskEither<RedisRepo.RedisRepositoryDeps, Error, boolean> =
  (
    user,
    data,
    expireAssertionRefSec = DEFAULT_LOLLIPOP_ASSERTION_REF_DURATION,
  ) =>
  (deps) =>
    pipe(
      TE.tryCatch(
        () =>
          deps.redisClientSelector
            .selectOne(RedisClientMode.FAST)
            .setEx(
              `${lollipopDataPrefix}${user.fiscal_code}`,
              expireAssertionRefSec,
              LollipopDataFromString.encode(data),
            ),
        E.toError,
      ),
      singleStringReplyAsync,
      falsyResponseToErrorAsync(new Error("Error setting user key")),
    );

const singleStringReplyAsync = (command: TE.TaskEither<Error, string | null>) =>
  pipe(
    command,
    TE.map((reply) => reply === "OK"),
  );
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
const arrayStringReplyAsync = (
  command: TE.TaskEither<Error, ReadonlyArray<string | null>>,
): Promise<E.Either<Error, NonEmptyArray<string>>> =>
  pipe(
    command,
    TE.chain(
      TE.fromPredicate(
        (res): res is NonEmptyArray<string> => isArray(res) && res.length > 0,
        () => RedisRepo.sessionNotFoundError,
      ),
    ),
  )();
const readSessionInfoKeys =
  (redisClientSelector: RedisClientSelectorType) =>
  (fiscalCode: FiscalCode): Promise<E.Either<Error, ReadonlyArray<string>>> =>
    pipe(
      TE.tryCatch(
        () =>
          redisClientSelector
            .selectOne(RedisClientMode.FAST)
            .sMembers(`${RedisRepo.userSessionsSetKeyPrefix}${fiscalCode}`),
        E.toError,
      ),
      arrayStringReplyAsync,
    );

// ---------------------------------
// User tokens
// ---------------------------------

const getUserTokens = (
  user: User,
): Record<string, { readonly prefix: string; readonly value: string }> => ({
  session_info: {
    prefix: RedisRepo.sessionInfoKeyPrefix,
    value: user.session_token,
  },
  session_token: {
    prefix: RedisRepo.sessionKeyPrefix,
    value: user.session_token,
  },
  wallet_token: {
    prefix: RedisRepo.walletKeyPrefix,
    value: user.wallet_token,
  },
  bpd_token: {
    prefix: RedisRepo.bpdTokenPrefix,
    value: user.bpd_token,
  },
  fims_token: {
    prefix: RedisRepo.fimsTokenPrefix,
    value: user.fims_token,
  },
  myportal_token: {
    prefix: RedisRepo.myPortalTokenPrefix,
    value: user.myportal_token,
  },
  zendesk_token: {
    prefix: RedisRepo.zendeskTokenPrefix,
    value: user.zendesk_token,
  },
});

const noneOrErrorWhenNotFound: <T>(
  error: Error,
) => RTE.ReaderTaskEither<T, Error, O.Option<never>> = (error) =>
  error === RedisRepo.sessionNotFoundError
    ? RTE.right(O.none)
    : RTE.left(error);

/**
 * Retrieves a value from the cache using the FIMS token.
 * @param token the fims token
 * @returns an RTE that returns either an Error or an user, if exists
 */
export const getByFIMSToken: (
  token: FIMSToken,
) => RTE.ReaderTaskEither<
  RedisRepo.RedisRepositoryDeps,
  Error,
  O.Option<User>
> = (token) =>
  pipe(
    loadSessionByToken(RedisRepo.fimsTokenPrefix, token),
    RTE.map(O.some),
    RTE.orElseW(noneOrErrorWhenNotFound),
  );

/**
 * Retrieves a value from the cache using the Zendesk token.
 * @param token - the zendesk token
 * @returns an RTE that returns either an Error or an user, if exists
 */
export const getByZendeskToken: (
  token: ZendeskToken,
) => RTE.ReaderTaskEither<
  RedisRepo.RedisRepositoryDeps,
  Error,
  O.Option<User>
> = (token) =>
  pipe(
    loadSessionByToken(RedisRepo.zendeskTokenPrefix, token),
    RTE.map(O.some),
    RTE.orElseW(noneOrErrorWhenNotFound),
  );

/**
 * Retrieves a value from the cache using the BPD token.
 * @param token the BPD token
 * @returns an RTE that returns either an Error or an user, if exists
 */
export const getByBPDToken: (
  token: BPDToken,
) => RTE.ReaderTaskEither<
  RedisRepo.RedisRepositoryDeps,
  Error,
  O.Option<User>
> = (token) =>
  pipe(
    loadSessionByToken(RedisRepo.bpdTokenPrefix, token),
    RTE.map(O.some),
    RTE.orElseW(noneOrErrorWhenNotFound),
  );

// ---------------------------------
// End\ User tokens
// ---------------------------------

const clearExpiredSetValues =
  (redisClientSelector: RedisClientSelectorType) =>
  async (
    fiscalCode: string,
  ): Promise<ReadonlyArray<E.Either<Error, boolean>>> => {
    const userSessionSetKey = `${RedisRepo.userSessionsSetKeyPrefix}${fiscalCode}`;
    const keysV2 = await pipe(
      TE.tryCatch(
        () =>
          redisClientSelector
            .selectOne(RedisClientMode.FAST)
            .sMembers(userSessionSetKey),
        E.toError,
      ),
      TE.mapLeft((err) => {
        log.error("Error reading set members: %s", err);
        // eslint-disable-next-line functional/prefer-readonly-type
        return [] as string[];
      }),
      TE.toUnion,
    )();

    const activeKeys = await Promise.all(
      keysV2.map((key) =>
        pipe(
          TE.tryCatch(
            () =>
              redisClientSelector.selectOne(RedisClientMode.FAST).exists(key),
            E.toError,
          ),
          TE.chainW(TE.fromPredicate((response) => !!response, identity)),
          TE.bimap(
            () => key,
            () => key,
          ),
        )(),
      ),
    );

    return await Promise.all(
      pipe(
        activeKeys
          .filter(E.isLeft)
          .map((key) =>
            redisClientSelector
              .selectOne(RedisClientMode.FAST)
              .sRem(userSessionSetKey, key.left),
          ),
        (keysRemPromises) =>
          keysRemPromises.map((promise) =>
            pipe(
              TE.tryCatch(() => promise, E.toError),
              integerReplyAsync(),
              (task) => task(),
            ),
          ),
      ),
    );
  };

const removeOtherUserSessions =
  (redisClientSelector: RedisClientSelectorType) =>
  async (user: User): Promise<E.Either<Error, boolean>> => {
    const errorOrSessionInfoKeys = await readSessionInfoKeys(
      redisClientSelector,
    )(user.fiscal_code);
    if (E.isRight(errorOrSessionInfoKeys)) {
      const oldSessionInfoKeys = errorOrSessionInfoKeys.right.filter(
        (_) =>
          _.startsWith(RedisRepo.sessionInfoKeyPrefix) &&
          _ !== `${RedisRepo.sessionInfoKeyPrefix}${user.session_token}`,
      );
      // Generate old session keys list from session info keys list
      // transforming pattern SESSIONINFO-token into pattern SESSION-token with token as the same value
      const oldSessionKeys = oldSessionInfoKeys.map(
        (_) =>
          `${RedisRepo.sessionKeyPrefix}${_.split(RedisRepo.sessionInfoKeyPrefix)[1]}`,
      );

      // Retrieve all user data related to session tokens.
      // All the tokens are stored inside user payload.
      const errorOrSerializedUserV2 = await pipe(
        oldSessionInfoKeys,
        ROA.map((key) =>
          TE.tryCatch(
            () => redisClientSelector.selectOne(RedisClientMode.FAST).get(key),
            E.toError,
          ),
        ),
        ROA.sequence(TE.ApplicativeSeq),
        // It's intended that some value can be null here
        arrayStringReplyAsync,
      );

      // Deserialize all available user payloads and skip invalid one
      const errorOrDeserializedUsers = pipe(
        errorOrSerializedUserV2,
        E.map((_) =>
          _.map(parseUser)
            .filter(E.isRight)
            .map((deserializedUser) => deserializedUser.right),
        ),
      );

      // Extract all tokens inside the user payload
      // If the value is invalid or must be skipped, it will be mapped with none
      const externalTokens = pipe(
        errorOrDeserializedUsers,
        E.mapLeft((_) => []),
        E.map((_) =>
          _.map((deserializedUser) =>
            pipe(
              getUserTokens(deserializedUser),
              R.filter(
                (p) =>
                  !(
                    p.prefix === RedisRepo.sessionInfoKeyPrefix ||
                    p.prefix === RedisRepo.sessionKeyPrefix
                  ) &&
                  !(
                    p.prefix === RedisRepo.walletKeyPrefix &&
                    p.value === user.wallet_token
                  ) &&
                  !(
                    p.prefix === RedisRepo.myPortalTokenPrefix &&
                    p.value === user.myportal_token
                  ) &&
                  !(
                    p.prefix === RedisRepo.bpdTokenPrefix &&
                    p.value === user.bpd_token
                  ) &&
                  !(
                    p.prefix === RedisRepo.zendeskTokenPrefix &&
                    p.value === user.zendesk_token
                  ) &&
                  !(
                    p.prefix === RedisRepo.fimsTokenPrefix &&
                    p.value === user.fims_token
                  ),
              ),
              R.collect((_1, { prefix, value }) => `${prefix}${value}`),
            ),
          ).reduce((prev, tokens) => [...prev, ...tokens], []),
        ),
        E.toUnion,
      );

      // Delete all active tokens that are different
      // from the new one generated and provided inside user object.
      const deleteOldKeysResponseV2 = await pipe(
        [...oldSessionInfoKeys, ...oldSessionKeys, ...externalTokens],
        TE.fromPredicate((keys) => keys.length === 0, identity),
        TE.fold(
          (keys) =>
            pipe(
              keys,
              ROA.map((singleKey) =>
                TE.tryCatch(
                  () =>
                    redisClientSelector
                      .selectOne(RedisClientMode.FAST)
                      .del(singleKey),
                  E.toError,
                ),
              ),
              ROA.sequence(TE.ApplicativeSeq),
              integerReplyAsync(),
            ),
          (_) => TE.right(true),
        ),
      )();
      await clearExpiredSetValues(redisClientSelector)(user.fiscal_code);
      return deleteOldKeysResponseV2;
    }
    return errorOrSessionInfoKeys.left === RedisRepo.sessionNotFoundError
      ? E.right(true)
      : E.left(errorOrSessionInfoKeys.left);
  };

const saveSessionInfo =
  (redisClientSelector: RedisClientSelectorType) =>
  (
    sessionInfo: SessionInfo,
    fiscalCode: FiscalCode,
    expireSec: number,
  ): TE.TaskEither<Error, boolean> => {
    const sessionInfoKey = `${RedisRepo.sessionInfoKeyPrefix}${sessionInfo.sessionToken}`;
    return pipe(
      TE.tryCatch(
        () =>
          redisClientSelector
            .selectOne(RedisClientMode.FAST)
            .setEx(sessionInfoKey, expireSec, JSON.stringify(sessionInfo)),
        E.toError,
      ),
      singleStringReplyAsync,
      falsyResponseToErrorAsync(new Error("Error setting user token info")),
      TE.chain((_) =>
        pipe(
          TE.tryCatch(
            () =>
              redisClientSelector
                .selectOne(RedisClientMode.FAST)
                .sAdd(
                  `${RedisRepo.userSessionsSetKeyPrefix}${fiscalCode}`,
                  sessionInfoKey,
                ),
            E.toError,
          ),
          integerReplyAsync(),
          falsyResponseToErrorAsync(
            new Error("Error updating user tokens info set"),
          ),
        ),
      ),
    );
  };

export const set =
  (redisClientSelector: RedisClientSelectorType, expireSec: number) =>
  (
    user: User,
    isUserSessionUpdate: boolean = false,
  ): TE.TaskEither<Error, boolean> => {
    const setSessionTokenV2 = pipe(
      TE.tryCatch(
        () =>
          // Set key to hold the string value. If key already holds a value, it is overwritten, regardless of its type.
          // @see https://redis.io/commands/set
          redisClientSelector
            .selectOne(RedisClientMode.FAST)
            .setEx(
              `${RedisRepo.sessionKeyPrefix}${user.session_token}`,
              expireSec,
              JSON.stringify(user),
            ),
        E.toError,
      ),
      singleStringReplyAsync,
      falsyResponseToErrorAsync(new Error("Error setting session token")),
    );

    const setWalletTokenV2 = pipe(
      TE.tryCatch(
        () =>
          redisClientSelector
            .selectOne(RedisClientMode.FAST)
            .setEx(
              `${RedisRepo.walletKeyPrefix}${user.wallet_token}`,
              expireSec,
              user.session_token,
            ),
        E.toError,
      ),
      singleStringReplyAsync,
      falsyResponseToErrorAsync(new Error("Error setting wallet token")),
    );

    const setMyPortalTokenV2 = pipe(
      TE.tryCatch(
        () =>
          redisClientSelector
            .selectOne(RedisClientMode.FAST)
            .setEx(
              `${RedisRepo.myPortalTokenPrefix}${user.myportal_token}`,
              expireSec,
              user.session_token,
            ),
        E.toError,
      ),
      singleStringReplyAsync,
      falsyResponseToErrorAsync(new Error("Error setting MyPortal token")),
    );

    const setBPDTokenV2 = pipe(
      TE.tryCatch(
        () =>
          redisClientSelector
            .selectOne(RedisClientMode.FAST)
            .setEx(
              `${RedisRepo.bpdTokenPrefix}${user.bpd_token}`,
              expireSec,
              user.session_token,
            ),
        E.toError,
      ),
      singleStringReplyAsync,
      falsyResponseToErrorAsync(new Error("Error setting BPD token")),
    );

    const setZendeskTokenV2 = pipe(
      TE.tryCatch(
        () =>
          redisClientSelector
            .selectOne(RedisClientMode.FAST)
            .setEx(
              `${RedisRepo.zendeskTokenPrefix}${user.zendesk_token}`,
              expireSec,
              user.session_token,
            ),
        E.toError,
      ),
      singleStringReplyAsync,
      falsyResponseToErrorAsync(new Error("Error setting Zendesk token")),
    );

    const setFIMSTokenV2 = pipe(
      TE.tryCatch(
        () =>
          redisClientSelector
            .selectOne(RedisClientMode.FAST)
            .setEx(
              `${RedisRepo.fimsTokenPrefix}${user.fims_token}`,
              expireSec,
              user.session_token,
            ),
        E.toError,
      ),
      singleStringReplyAsync,
      falsyResponseToErrorAsync(new Error("Error setting FIMS token")),
    );

    // If is a session update, the session info key doesn't must be updated.
    // eslint-disable-next-line functional/no-let
    let saveSessionInfoPromise: TE.TaskEither<Error, boolean> = TE.right(true);
    if (!isUserSessionUpdate) {
      const sessionInfo: SessionInfo = {
        createdAt: new Date(),
        sessionToken: user.session_token,
      };
      saveSessionInfoPromise = saveSessionInfo(redisClientSelector)(
        sessionInfo,
        user.fiscal_code,
        expireSec,
      );
    }

    const removeOtherUserSessionsPromise =
      removeOtherUserSessions(redisClientSelector)(user);

    return pipe(
      A.sequence(T.taskSeq)([
        setSessionTokenV2,
        setWalletTokenV2,
        setMyPortalTokenV2,
        setBPDTokenV2,
        setZendeskTokenV2,
        setFIMSTokenV2,
        saveSessionInfoPromise,
        pipe(
          TE.tryCatch(() => removeOtherUserSessionsPromise, E.toError),
          TE.mapLeft((e) => E.left<Error, boolean>(e)),
          TE.toUnion,
        ),
      ]),
      TE.fromTask,
      TE.chain(
        TE.fromPredicate(
          (tasksResults) => !A.some(E.isLeft)(tasksResults),
          (results) =>
            multipleErrorsFormatter(
              results.filter(E.isLeft).map((result) => result.left),
              "RedisSessionStorage.set",
            ),
        ),
      ),
      TE.map(() => true),
    );
  };

/**
 * Delete all tokens related to the user
 * @param user
 * @returns a task of either an error or true
 */
export const deleteUser: (
  user: User,
) => RTE.ReaderTaskEither<RedisRepo.RedisRepositoryDeps, Error, true> =
  (user) => (deps) =>
    pipe(
      getUserTokens(user),
      R.collect(S.Ord)((_, { prefix, value }) => `${prefix}${value}`),
      (tokens) =>
        pipe(
          tokens,
          ROA.map((singleToken) =>
            TE.tryCatch(
              () =>
                deps.redisClientSelector
                  .selectOne(RedisClientMode.FAST)
                  .del(singleToken),
              E.toError,
            ),
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
          TE.chainFirst((_) => {
            // Remove SESSIONINFO reference from USERSESSIONS Set
            // this operation is executed in background and doesn't compromise
            // the logout process.
            deps.redisClientSelector
              .selectOne(RedisClientMode.FAST)
              .sRem(
                `${RedisRepo.userSessionsSetKeyPrefix}${user.fiscal_code}`,
                `${RedisRepo.sessionInfoKeyPrefix}${user.session_token}`,
              )
              .catch((_) => {
                log.warn(
                  `Error deleting USERSESSIONS Set for ${user.fiscal_code}`,
                );
              });
            return TE.of(true);
          }),
        ),
    );

/**
 * Check if a user is blocked
 *
 * @param dependencies - RedisClientSelector and fiscalCode of the user
 *
 * @returns a promise with either an error or a boolean indicating if the user is blocked
 */
export const isBlockedUser: RTE.ReaderTaskEither<
  {
    redisClientSelector: RedisClientSelectorType;
  } & { fiscalCode: FiscalCode },
  Error,
  boolean
> = ({ redisClientSelector, fiscalCode }) =>
  pipe(
    TE.tryCatch(
      () =>
        redisClientSelector
          .selectOne(RedisClientMode.FAST)
          .sIsMember(blockedUserSetKey, fiscalCode),
      E.toError,
    ),
    TE.bimap(
      (err) => new Error(`Error accessing blocked users collection: ${err}`),
      identity,
    ),
  );
