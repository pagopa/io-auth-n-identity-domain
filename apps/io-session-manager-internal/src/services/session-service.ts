import * as RTE from "fp-ts/lib/ReaderTaskEither";
import * as ROA from "fp-ts/ReadonlyArray";
import * as TE from "fp-ts/lib/TaskEither";
import * as AP from "fp-ts/Apply";
import * as B from "fp-ts/lib/boolean";
import * as O from "fp-ts/lib/Option";
import * as redisLib from "redis";
import { flow, pipe } from "fp-ts/lib/function";
import { FiscalCode } from "@pagopa/ts-commons/lib/strings";
import { TableClient } from "@azure/data-tables";
import { QueueClient } from "@azure/storage-queue";
import { ReadonlyNonEmptyArray } from "fp-ts/lib/ReadonlyNonEmptyArray";
import { addSeconds } from "date-fns";
import { OutputOf } from "io-ts";
import {
  AuthSessionsTopicRepository,
  AuthSessionsTopicRepositoryDeps,
} from "@pagopa/io-auth-n-identity-commons/repositories/auth-sessions-topic-repository";
import {
  EventTypeEnum,
  LogoutScenarioEnum,
} from "@pagopa/io-auth-n-identity-commons/types/auth-session-event";
import { RedisRepository } from "../repositories/redis";
import { UserSessionInfo } from "../generated/definitions/internal/UserSessionInfo";
import { UnlockCode } from "../generated/definitions/internal/UnlockCode";
import {
  AuthLockRepository,
  NotReleasedAuthenticationLockData,
} from "../repositories/auth-lock";
import {
  ConflictError,
  ForbiddenError,
  GenericError,
  forbiddenError,
  toConflictError,
  toGenericError,
} from "../utils/errors";
import { LollipopRepository } from "../repositories/lollipop";
import { InstallationRepository } from "../repositories/installation";
import { SessionState } from "../generated/definitions/internal/SessionState";
import { TypeEnum as LoginTypeEnum } from "../generated/definitions/internal/SessionInfo";
import { isUserEligibleForServiceBusEvents } from "../utils/config";

type RedisDeps = {
  FastRedisClientTask: TE.TaskEither<Error, redisLib.RedisClusterType>;
  SafeRedisClientTask: TE.TaskEither<Error, redisLib.RedisClusterType>;
  RedisRepository: RedisRepository;
};

const ERROR_CHECK_USER_AUTH_LOCK =
  "Something went wrong while checking the user authentication lock";

export type GetUserSessionDeps = RedisDeps;
const getUserSession: (
  fiscalCode: FiscalCode,
) => RTE.ReaderTaskEither<RedisDeps, Error, UserSessionInfo> =
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

export type GetUserSessionStateDeps = Pick<
  RedisDeps,
  "SafeRedisClientTask" | "RedisRepository"
> & {
  AuthLockRepository: AuthLockRepository;
  AuthenticationLockTableClient: TableClient;
};
const getUserSessionState: (
  fiscalCode: FiscalCode,
) => RTE.ReaderTaskEither<
  GetUserSessionStateDeps,
  GenericError,
  OutputOf<typeof SessionState>
> = (fiscalCode) => (deps) =>
  pipe(
    deps.SafeRedisClientTask,
    TE.mapLeft((err) =>
      toGenericError(`Could not establish connection to redis: ${err.message}`),
    ),
    TE.chain((safeClient) =>
      pipe(
        AP.sequenceS(TE.ApplicativePar)({
          isUserAuthenticationLocked: pipe(
            deps.AuthLockRepository.isUserAuthenticationLocked(fiscalCode)(
              deps,
            ),
            TE.mapLeft((err) =>
              toGenericError(
                `Error reading the auth lock info: [${err.message}]`,
              ),
            ),
          ),
          maybeSessionRemaningTTL: pipe(
            deps.RedisRepository.getSessionRemainingTTL({
              fiscalCode,
              safeClient,
            }),
            TE.mapLeft((err) =>
              toGenericError(
                `Error reading the session info: [${err.message}]`,
              ),
            ),
          ),
        }),
        TE.map(({ isUserAuthenticationLocked, maybeSessionRemaningTTL }) =>
          O.isNone(maybeSessionRemaningTTL)
            ? SessionState.encode({
                access_enabled: !isUserAuthenticationLocked,
                session_info: { active: false },
              })
            : SessionState.encode({
                access_enabled: !isUserAuthenticationLocked,
                session_info: {
                  active: true,
                  expiration_date: addSeconds(
                    new Date(),
                    maybeSessionRemaningTTL.value.ttl,
                  ),
                  type: LoginTypeEnum[maybeSessionRemaningTTL.value.type],
                },
              }),
        ),
      ),
    ),
  );

const invalidateUserSession: (fiscalCode: FiscalCode) => RTE.ReaderTaskEither<
  {
    SafeRedisClient: redisLib.RedisClusterType;
    FastRedisClient: redisLib.RedisClusterType;
  } & Pick<
    LockUserAuthenticationDeps,
    "RedisRepository" | "LollipopRepository" | "RevokeAssertionRefQueueClient"
  >,
  Error,
  true
> = (fiscalCode) => (deps) =>
  pipe(
    AP.sequenceT(TE.ApplicativeSeq)(
      // revoke pubkey
      pipe(
        // retrieve the assertionRef for the user
        deps.RedisRepository.getLollipopAssertionRefForUser({
          safeClient: deps.SafeRedisClient,
          fiscalCode,
        }),
        TE.chainW(
          flow(
            O.map((assertionRef) =>
              deps.LollipopRepository.fireAndForgetRevokeAssertionRef(
                assertionRef,
              )(deps),
            ),
            // continue if there's no assertionRef on redis
            O.getOrElseW(() => TE.of(true as const)),
          ),
        ),
      ),
      // delete the assertionRef for the user
      deps.RedisRepository.delLollipopDataForUser({
        fastClient: deps.FastRedisClient,
        fiscalCode,
      }),
      // removes all sessions
      deps.RedisRepository.delUserAllSessions({
        fastClient: deps.FastRedisClient,
        fiscalCode,
      }),
    ),
    TE.map(() => true),
  );

const clearInstallation: (
  fiscalCode: FiscalCode,
) => RTE.ReaderTaskEither<
  Pick<
    LockUserAuthenticationDeps,
    "InstallationRepository" | "NotificationQueueClient"
  >,
  Error,
  true
> = (fiscalCode) => (deps) =>
  pipe(
    deps.InstallationRepository.deleteInstallation(fiscalCode)(deps),
    TE.mapLeft((err) =>
      Error(`Cannot delete Notification Installation: ${err.message}`),
    ),
    TE.map((_) => true),
  );

export type LockUserAuthenticationDeps = RedisDeps & {
  AuthLockRepository: AuthLockRepository;
  AuthenticationLockTableClient: TableClient;
  LollipopRepository: LollipopRepository;
  RevokeAssertionRefQueueClient: QueueClient;
  InstallationRepository: InstallationRepository;
  NotificationQueueClient: QueueClient;
};
const lockUserAuthentication: (
  fiscalCode: FiscalCode,
  unlockCode: UnlockCode,
) => RTE.ReaderTaskEither<
  LockUserAuthenticationDeps,
  GenericError | ConflictError,
  null
> = (fiscalCode, unlockCode) => (deps) =>
  pipe(
    {
      FastRedisClient: deps.FastRedisClientTask,
      SafeRedisClient: deps.SafeRedisClientTask,
    },
    AP.sequenceS(TE.ApplySeq),
    TE.mapLeft((err) =>
      toGenericError(`Could not establish connection to redis: ${err.message}`),
    ),
    TE.chainW(({ FastRedisClient, SafeRedisClient }) =>
      pipe(
        deps.AuthLockRepository.isUserAuthenticationLocked(fiscalCode)(deps),
        TE.mapLeft((_) => toGenericError(ERROR_CHECK_USER_AUTH_LOCK)),
        TE.filterOrElseW(
          (isUserAuthenticationLocked) => !isUserAuthenticationLocked,
          () =>
            toConflictError(
              "Another user authentication lock has already been applied",
            ),
        ),
        TE.chainW(() =>
          pipe(
            AP.sequenceT(TE.ApplicativeSeq)(
              // clear session data
              invalidateUserSession(fiscalCode)({
                ...deps,
                FastRedisClient,
                SafeRedisClient,
              }),
              // clear installation before locking the user account
              // for allowing allow the FE to retry the call in case of failure.
              clearInstallation(fiscalCode)(deps),
              // if clean up went well, lock user session
              deps.AuthLockRepository.lockUserAuthentication(
                fiscalCode,
                unlockCode,
              )(deps),
            ),
            TE.mapLeft((err) => toGenericError(err.message)),
          ),
        ),
      ),
    ),
    TE.map((_) => null),
  );

const unlockuserAuthenticationLockData: (
  fiscalCode: FiscalCode,
  maybeUnlockCode: O.Option<UnlockCode>,
  authLockData: ReadonlyNonEmptyArray<NotReleasedAuthenticationLockData>,
) => RTE.ReaderTaskEither<
  UnlockUserAuthenticationDeps,
  GenericError | ForbiddenError,
  true
> = (fiscalCode, maybeUnlockCode, authLockData) => (deps) =>
  pipe(
    {},
    TE.fromPredicate(
      () =>
        O.isNone(maybeUnlockCode) ||
        authLockData.some((data) => data.rowKey === maybeUnlockCode.value),
      () => forbiddenError,
    ),
    TE.map(() =>
      O.isSome(maybeUnlockCode)
        ? [maybeUnlockCode.value]
        : authLockData.map((data) => data.rowKey),
    ),
    TE.chainW((codesToUnlock) =>
      pipe(
        deps.AuthLockRepository.unlockUserAuthentication(
          fiscalCode,
          codesToUnlock,
        )(deps),
        TE.mapLeft(() =>
          toGenericError("Error releasing user authentication lock"),
        ),
      ),
    ),
  );

export type UnlockUserAuthenticationDeps = {
  AuthLockRepository: AuthLockRepository;
  AuthenticationLockTableClient: TableClient;
};
const unlockUserAuthentication: (
  fiscalCode: FiscalCode,
  unlockCode?: UnlockCode,
) => RTE.ReaderTaskEither<
  UnlockUserAuthenticationDeps,
  GenericError | ForbiddenError,
  null
> = (fiscalCode, unlockCode) => (deps) =>
  pipe(
    unlockCode,
    O.fromNullable,
    TE.of,
    TE.bindTo("maybeUnlockCode"),
    TE.bind("authLockData", () =>
      pipe(
        deps.AuthLockRepository.getUserAuthenticationLocks(fiscalCode)(deps),
        TE.mapLeft((_) => toGenericError(ERROR_CHECK_USER_AUTH_LOCK)),
      ),
    ),
    TE.chainW(({ authLockData, maybeUnlockCode }) =>
      ROA.isNonEmpty(authLockData)
        ? // User auth is locked
          unlockuserAuthenticationLockData(
            fiscalCode,
            maybeUnlockCode,
            authLockData,
          )(deps)
        : // User auth is NOT locked
          TE.of(true),
    ),
    TE.map(() => null),
  );

export type DeleteUserSessionDeps = RedisDeps & {
  LollipopRepository: LollipopRepository;
  RevokeAssertionRefQueueClient: QueueClient;
  AuthSessionsTopicRepository: AuthSessionsTopicRepository;
} & AuthSessionsTopicRepositoryDeps;
const deleteUserSession: (
  fiscalCode: FiscalCode,
) => RTE.ReaderTaskEither<DeleteUserSessionDeps, GenericError, null> =
  (fiscalCode) => (deps) =>
    pipe(
      {
        SafeRedisClient: deps.SafeRedisClientTask,
        FastRedisClient: deps.FastRedisClientTask,
      },
      AP.sequenceS(TE.ApplySeq),
      TE.mapLeft((err) =>
        toGenericError(
          `Could not establish connection to redis: ${err.message}`,
        ),
      ),
      TE.chain(({ FastRedisClient, SafeRedisClient }) =>
        pipe(
          invalidateUserSession(fiscalCode)({
            ...deps,
            FastRedisClient,
            SafeRedisClient,
          }),
          TE.chainFirst((_) => emitLogoutIfEligible(fiscalCode)(deps)),
          TE.mapLeft((err) => toGenericError(err.message)),
        ),
      ),
      TE.map((_) => null),
    );

const emitLogoutIfEligible: (
  fiscalCode: FiscalCode,
) => RTE.ReaderTaskEither<DeleteUserSessionDeps, Error, void> =
  (fiscalCode) => (deps) =>
    pipe(
      isUserEligibleForServiceBusEvents(fiscalCode),
      B.match(
        () => TE.of(void 0),
        () =>
          deps.AuthSessionsTopicRepository.emitSessionEvent({
            fiscalCode,
            eventType: EventTypeEnum.LOGOUT,
            scenario: LogoutScenarioEnum.WEB,
            ts: new Date(),
          })(deps),
      ),
    );

export type SessionService = typeof SessionService;
export const SessionService = {
  getUserSession,
  lockUserAuthentication,
  unlockUserAuthentication,
  deleteUserSession,
  invalidateUserSession,
  getUserSessionState,
};
