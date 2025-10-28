import * as redisLib from "redis";

import * as AP from "fp-ts/lib/Apply";
import * as RTE from "fp-ts/lib/ReaderTaskEither";
import * as TE from "fp-ts/lib/TaskEither";

import { pipe } from "fp-ts/lib/function";

import { FiscalCode } from "@pagopa/ts-commons/lib/strings";

import {
  AuthSessionsTopicRepository,
  AuthSessionsTopicRepositoryDeps,
} from "@pagopa/io-auth-n-identity-commons/repositories/auth-sessions-topic-repository";
import { EventTypeEnum } from "@pagopa/io-auth-n-identity-commons/types/session-event/event-type";
import {
  LogoutEvent,
  LogoutScenarioEnum,
} from "@pagopa/io-auth-n-identity-commons/types/session-event/logout-event";

import { BlockedUsersRedisRepository } from "../repositories/blocked-users-redis";
import {
  Dependencies as LollipopRepoDependencies,
  LollipopRepository,
} from "../repositories/lollipop";
import { RedisRepository } from "../repositories/redis";
import { trackEvent } from "../utils/appinsights";
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
        emitLogoutEvent({
          fiscalCode,
          eventType: EventTypeEnum.LOGOUT,
          scenario: LogoutScenarioEnum.ACCOUNT_REMOVAL,
          ts: new Date(),
        })(deps),
      ),
      TE.map((_) => true),
    );

const emitLogoutEvent: (
  eventData: LogoutEvent,
) => RTE.ReaderTaskEither<BlockedUsersServiceDeps, Error, void> =
  (eventData) => (deps) =>
    pipe(
      deps.AuthSessionsTopicRepository.emitSessionEvent(eventData)(deps),
      TE.mapLeft((err) => {
        trackEvent({
          name: "service-bus.auth-event.emission-failure",
          properties: {
            eventData,
            message: err.message,
          },
          tagOverrides: {
            samplingEnabled: "false",
          },
        });
        return err;
      }),
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
