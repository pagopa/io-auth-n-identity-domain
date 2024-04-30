import { isArray } from "util";
import * as E from "fp-ts/Either";
import * as O from "fp-ts/Option";
import { flow, identity, pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";
import * as R from "fp-ts/lib/Record";
import * as A from "fp-ts/Array";
import * as T from "fp-ts/Task";
import { errorsToReadableMessages } from "@pagopa/ts-commons/lib/reporters";
import { FiscalCode } from "@pagopa/ts-commons/lib/strings";
import { isNumber } from "fp-ts/lib/number";
import { NonEmptyArray } from "fp-ts/lib/NonEmptyArray";
import * as ROA from "fp-ts/ReadonlyArray";
import { SessionToken } from "../types/token";
import { User } from "../types/user";
import {
  RedisClientMode,
  RedisClientSelectorType,
  bpdTokenPrefix,
  fimsTokenPrefix,
  lollipopDataPrefix,
  myPortalTokenPrefix,
  sessionInfoKeyPrefix,
  sessionKeyPrefix,
  sessionNotFoundError,
  userSessionsSetKeyPrefix,
  walletKeyPrefix,
  zendeskTokenPrefix,
} from "../repositories/redis";
import {
  LollipopData,
  NullableBackendAssertionRefFromString,
} from "../types/assertion-ref";
import { LoginTypeEnum } from "../types/fast-login";
import { AssertionRef } from "../generated/backend/AssertionRef";
import { SessionInfo } from "../generated/backend/SessionInfo";
import { log } from "../utils/logger";
import { multipleErrorsFormatter } from "../utils/errors";

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

const loadSessionBySessionToken =
  (redisClientSelector: RedisClientSelectorType) =>
  (token: SessionToken): TE.TaskEither<Error, User> =>
    pipe(
      TE.tryCatch(
        () =>
          redisClientSelector
            .selectOne(RedisClientMode.FAST)
            .get(`${sessionKeyPrefix}${token}`),
        E.toError,
      ),
      TE.chain(
        flow(
          O.fromNullable,
          E.fromOption(() => sessionNotFoundError),
          E.chain(parseUser),
          TE.fromEither,
        ),
      ),
    );

export const getBySessionToken =
  (redisClientSelector: RedisClientSelectorType) =>
  (token: SessionToken): TE.TaskEither<Error, O.Option<User>> =>
    pipe(
      loadSessionBySessionToken(redisClientSelector)(token),
      TE.foldW(
        (err) =>
          err === sessionNotFoundError
            ? TE.right<Error, O.Option<User>>(O.none)
            : TE.left<Error, O.Option<User>>(err),
        (_) => TE.right<Error, O.Option<User>>(O.some(_)),
      ),
    );

export const getLollipopAssertionRefForUser =
  (redisClientSelector: RedisClientSelectorType) =>
  (
    fiscalCode: FiscalCode,
    // TODO: Use BackendAssertionRef instead
  ): TE.TaskEither<Error, O.Option<AssertionRef>> =>
    pipe(
      getLollipopDataForUser(redisClientSelector)(fiscalCode),
      TE.map(O.map((data) => data.assertionRef)),
    );

const getLollipopDataForUser =
  (redisClientSelector: RedisClientSelectorType) =>
  (fiscalCode: FiscalCode): TE.TaskEither<Error, O.Option<LollipopData>> =>
    pipe(
      TE.tryCatch(
        () =>
          redisClientSelector
            .selectOne(RedisClientMode.SAFE)
            .get(`${lollipopDataPrefix}${fiscalCode}`),
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
        () => sessionNotFoundError,
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
            .sMembers(`${userSessionsSetKeyPrefix}${fiscalCode}`),
        E.toError,
      ),
      arrayStringReplyAsync,
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

const clearExpiredSetValues =
  (redisClientSelector: RedisClientSelectorType) =>
  async (
    fiscalCode: string,
  ): Promise<ReadonlyArray<E.Either<Error, boolean>>> => {
    const userSessionSetKey = `${userSessionsSetKeyPrefix}${fiscalCode}`;
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
          _.startsWith(sessionInfoKeyPrefix) &&
          _ !== `${sessionInfoKeyPrefix}${user.session_token}`,
      );
      // Generate old session keys list from session info keys list
      // transforming pattern SESSIONINFO-token into pattern SESSION-token with token as the same value
      const oldSessionKeys = oldSessionInfoKeys.map(
        (_) => `${sessionKeyPrefix}${_.split(sessionInfoKeyPrefix)[1]}`,
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
                    p.prefix === sessionInfoKeyPrefix ||
                    p.prefix === sessionKeyPrefix
                  ) &&
                  !(
                    p.prefix === walletKeyPrefix &&
                    p.value === user.wallet_token
                  ) &&
                  !(
                    p.prefix === myPortalTokenPrefix &&
                    p.value === user.myportal_token
                  ) &&
                  !(
                    p.prefix === bpdTokenPrefix && p.value === user.bpd_token
                  ) &&
                  !(
                    p.prefix === zendeskTokenPrefix &&
                    p.value === user.zendesk_token
                  ) &&
                  !(
                    p.prefix === fimsTokenPrefix && p.value === user.fims_token
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
    return errorOrSessionInfoKeys.left === sessionNotFoundError
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
    const sessionInfoKey = `${sessionInfoKeyPrefix}${sessionInfo.sessionToken}`;
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
                  `${userSessionsSetKeyPrefix}${fiscalCode}`,
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
              `${sessionKeyPrefix}${user.session_token}`,
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
              `${walletKeyPrefix}${user.wallet_token}`,
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
              `${myPortalTokenPrefix}${user.myportal_token}`,
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
              `${bpdTokenPrefix}${user.bpd_token}`,
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
              `${zendeskTokenPrefix}${user.zendesk_token}`,
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
              `${fimsTokenPrefix}${user.fims_token}`,
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
