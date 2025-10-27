import { beforeEach, describe, expect, it, vi } from "vitest";
import * as E from "fp-ts/lib/Either";
import * as TE from "fp-ts/lib/TaskEither";
import * as RTE from "fp-ts/lib/ReaderTaskEither";
import {
  EventTypeEnum,
  LogoutEvent,
} from "@pagopa/io-auth-n-identity-commons/types/auth-session-event";
import { LogoutScenarioEnum } from "@pagopa/io-auth-n-identity-commons/types/logout-event";
import * as appinsights from "../../utils/appinsights";
import { BlockedUsersService } from "../blocked-users-service";

import {
  RedisClientTaskMock,
  RedisRepositoryMock,
} from "../../__mocks__/repositories/redis.mock";
import {
  mockUnsetBlockedUser,
  BlockedUsersRedisRepositoryMock,
  mockSetBlockedUser,
} from "../../__mocks__/repositories/blocked-users-redis.mock";
import { aFiscalCode } from "../../repositories/__tests__/blocked-users-redis.test";
import { LollipopRepositoryMock } from "../../__mocks__/repositories/lollipop.mock";
import { mockQueueClient } from "../../__mocks__/queue-client.mock";
import {
  mockInvalidateUserSession,
  SessionServiceMock,
} from "../../__mocks__/services/session-service.mock";
import {
  AuthSessionsTopicRepositoryMock,
  mockEmitSessionEvent,
  ServiceBusSenderMock,
} from "../../__mocks__/repositories/auth-sessions-topic.mock";

const deps = {
  fastRedisClientTask: RedisClientTaskMock,
  safeRedisClientTask: RedisClientTaskMock,
  blockedUserRedisRepository: BlockedUsersRedisRepositoryMock,
  sessionService: SessionServiceMock,
  lollipopRepository: LollipopRepositoryMock,
  redisRepository: RedisRepositoryMock,
  RevokeAssertionRefQueueClient: mockQueueClient,
  AuthSessionsTopicRepository: AuthSessionsTopicRepositoryMock,
  authSessionsTopicSender: ServiceBusSenderMock,
};

const trackEventMock = vi.spyOn(appinsights, "trackEvent");

describe("Blocked Users Service#lockUserSession", () => {
  const frozenDate = new Date(2025, 5, 1, 0, 0, 0);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ now: frozenDate });
  });

  it("should succeed locking a user session and raising a logout event", async () => {
    const result =
      await BlockedUsersService.lockUserSession(aFiscalCode)(deps)();

    expect(mockInvalidateUserSession).toHaveBeenCalledTimes(1);
    expect(mockSetBlockedUser).toHaveBeenCalledTimes(1);
    expect(mockEmitSessionEvent).toHaveBeenCalledTimes(1);
    expect(mockEmitSessionEvent).toHaveBeenCalledWith({
      fiscalCode: aFiscalCode,
      eventType: EventTypeEnum.LOGOUT,
      scenario: LogoutScenarioEnum.ACCOUNT_REMOVAL,
      ts: frozenDate,
    });
    expect(trackEventMock).not.toHaveBeenCalled();
    expect(result).toEqual(E.right(true));
  });

  it("should write a new applicationInsight customEvent, when an error occurs while emitting a serviceBus logout event", async () => {
    const simulatedError = new Error("Simulated Error");

    mockEmitSessionEvent.mockImplementationOnce(() => RTE.left(simulatedError));

    const expectedEventData: LogoutEvent = {
      fiscalCode: aFiscalCode,
      eventType: EventTypeEnum.LOGOUT,
      scenario: LogoutScenarioEnum.ACCOUNT_REMOVAL,
      ts: frozenDate,
    };

    const result =
      await BlockedUsersService.lockUserSession(aFiscalCode)(deps)();

    expect(mockInvalidateUserSession).toHaveBeenCalledOnce();
    expect(mockSetBlockedUser).toHaveBeenCalledOnce();
    expect(mockEmitSessionEvent).toHaveBeenCalledOnce();
    expect(mockEmitSessionEvent).toHaveBeenCalledWith(expectedEventData);
    expect(trackEventMock).toHaveBeenCalledOnce();
    expect(trackEventMock).toHaveBeenCalledWith({
      name: "service-bus.auth-event.emission-failure",
      properties: {
        eventData: expectedEventData,
        message: simulatedError.message,
      },
      tagOverrides: {
        samplingEnabled: "false",
      },
    });
    expect(result).toEqual(E.left(simulatedError));
  });

  it("should fail if an error occurred adding the user to the blocked users list", async () => {
    const customError = Error("custom error");
    mockSetBlockedUser.mockReturnValueOnce(() => TE.left(customError));

    const result =
      await BlockedUsersService.lockUserSession(aFiscalCode)(deps)();

    expect(mockEmitSessionEvent).not.toHaveBeenCalledOnce();
    expect(result).toEqual(E.left(customError));
  });

  it("should fail if an error occurred invalidation the user session", async () => {
    const customError = Error("session invalidation error");
    mockInvalidateUserSession.mockReturnValueOnce(RTE.left(customError));

    const result =
      await BlockedUsersService.lockUserSession(aFiscalCode)(deps)();

    expect(mockEmitSessionEvent).not.toHaveBeenCalledOnce();
    expect(result).toEqual(E.left(customError));
  });
});

describe("Blocked Users Service#unlockUserSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should succeed with an valid user", async () => {
    const result =
      await BlockedUsersService.unlockUserSession(aFiscalCode)(deps)();

    expect(mockUnsetBlockedUser).toHaveBeenCalledTimes(1);
    expect(result).toEqual(E.right(true));
  });

  it("should fail if an error occurred removing the user from the blocked user list", async () => {
    const customError = Error("custom error");
    mockUnsetBlockedUser.mockReturnValueOnce(() => TE.left(customError));

    const result =
      await BlockedUsersService.unlockUserSession(aFiscalCode)(deps)();

    expect(mockUnsetBlockedUser).toHaveBeenCalledTimes(1);
    expect(result).toEqual(E.left(customError));
  });
});
