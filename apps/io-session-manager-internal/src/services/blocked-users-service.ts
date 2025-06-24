import * as redisLib from "redis";

import * as RTE from "fp-ts/lib/ReaderTaskEither";
import * as TE from "fp-ts/lib/TaskEither";
import * as AP from "fp-ts/lib/Apply";
import * as B from "fp-ts/lib/boolean";

import { pipe } from "fp-ts/lib/function";

import { FiscalCode } from "@pagopa/ts-commons/lib/strings";

import {
  AuthSessionsTopicRepository,
  AuthSessionsTopicRepositoryDeps,
} from "@pagopa/io-auth-n-identity-commons/repositories/auth-sessions-topic-repository";
import {
  EventTypeEnum,
  LogoutScenarioEnum,
} from "@pagopa/io-auth-n-identity-commons/types/auth-session-event";

import { BlockedUsersRedisRepository } from "../repositories/blocked-users-redis";
import { RedisRepository } from "../repositories/redis";
import {
  LollipopRepository,
  Dependencies as LollipopRepoDependencies,
} from "../repositories/lollipop";
import { isUserEligibleForServiceBusEvents } from "../utils/config";
import { SessionService } from "./session-service";

export type BlockedUsersServiceDeps = {
  fastRedisClientTask: TE.TaskEither<Error, redisLib.RedisClusterType>;
  safeRedisClientTask: TE.TaskEither<Error, redisLib.RedisClusterType>;
  sessionService: SessionService;
  blockedUserRedisRepository: BlockedUsersRedisRepository;
  redisRepository: RedisRepository;
  lollipopRepository: LollipopRepository;
  AuthSessionsTopicRepository: AuthSessionsTopicRepository;
} & AuthSessionsTopicRepositoryDeps &
  LollipopRepoDependencies;

const lockUserSession: (
  fiscalCode: FiscalCode,
) => RTE.ReaderTaskEither<BlockedUsersServiceDeps, Error, true> =
  (fiscalCode) => (deps) =>
    pipe(
      {
        fastClient: deps.fastRedisClientTask,
        safeClient: deps.safeRedisClientTask,
      },
      AP.sequenceS(TE.ApplySeq),
      TE.chain((redisClients) =>
        AP.sequenceT(TE.ApplicativeSeq)(
          deps.blockedUserRedisRepository.setBlockedUser(fiscalCode)(
            redisClients,
          ),
          deps.sessionService.invalidateUserSession(fiscalCode)({
            FastRedisClient: redisClients.fastClient,
            SafeRedisClient: redisClients.safeClient,
            LollipopRepository: deps.lollipopRepository,
            RedisRepository: deps.redisRepository,
            RevokeAssertionRefQueueClient: deps.RevokeAssertionRefQueueClient,
          }),
        ),
      ),
      TE.chainFirst((_) =>
        emitLogoutIfEligible(
          fiscalCode,
          LogoutScenarioEnum.ACCOUNT_REMOVAL,
        )(deps),
      ),
      TE.map((_) => true),
    );

const emitLogoutIfEligible: (
  fiscalCode: FiscalCode,
  scenario: LogoutScenarioEnum,
) => RTE.ReaderTaskEither<
  {
    AuthSessionsTopicRepository: AuthSessionsTopicRepository;
  } & AuthSessionsTopicRepositoryDeps,
  Error,
  void
> = (fiscalCode, scenario) => (deps) =>
  pipe(
    isUserEligibleForServiceBusEvents(fiscalCode),
    B.match(
      () => TE.of(void 0),
      () =>
        deps.AuthSessionsTopicRepository.emitSessionEvent({
          fiscalCode,
          eventType: EventTypeEnum.LOGOUT,
          scenario,
          ts: new Date(),
        })(deps),
    ),
  );

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
export const BlockedUsersService = { lockUserSession, unlockUserSession };
