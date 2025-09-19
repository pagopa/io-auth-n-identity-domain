/* eslint-disable max-lines-per-function */
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as E from "fp-ts/lib/Either";
import * as TE from "fp-ts/lib/TaskEither";
import * as RTE from "fp-ts/lib/ReaderTaskEither";
import * as O from "fp-ts/lib/Option";
import { FiscalCode } from "@pagopa/ts-commons/lib/strings";
import { QueueClient } from "@azure/storage-queue";
import { TableClient } from "@azure/data-tables";
import addSeconds from "date-fns/add_seconds";
import {
  EventTypeEnum,
  LogoutEvent,
  LogoutScenarioEnum,
} from "@pagopa/io-auth-n-identity-commons/types/auth-session-event";
import * as appinsights from "../../utils/appinsights";
import {
  RedisClientTaskMock,
  RedisRepositoryMock,
  mockDelLollipopDataForUser,
  mockDelUserAllSessions,
  mockGetLollipopAssertionRefForUser,
  mockGetSessionRemainingTTL,
  mockUserHasActiveSessionsOrLV,
} from "../../__mocks__/repositories/redis.mock";
import { SessionService } from "../session-service";
import {
  AuthLockRepositoryMock,
  mockGetUserAuthenticationLocks,
  mockIsUserAuthenticationLocked,
  mockLockUserAuthentication,
  mockUnlockUserAuthentication,
} from "../../__mocks__/repositories/auth-lock.mock";
import {
  LollipopRepositoryMock,
  mockfireAndForgetRevokeAssertionRef,
} from "../../__mocks__/repositories/lollipop.mock";
import {
  InstallationRepositoryMock,
  mockDeleteInstallation,
} from "../../__mocks__/repositories/installation.mock";
import {
  anUnlockCode,
  anUnlockedUserSessionState,
  anotherUnlockCode,
} from "../../__mocks__/user.mock";
import {
  forbiddenError,
  toConflictError,
  toGenericError,
} from "../../utils/errors";
import { aNotReleasedData } from "../../__mocks__/table-client.mock";
import { LoginTypeEnum } from "../../types/fast-login";
import {
  AuthSessionsTopicRepositoryMock,
  ServiceBusSenderMock,
  mockEmitSessionEvent,
} from "../../__mocks__/repositories/auth-sessions-topic.mock";

const aFiscalCode = "SPNDNL80R13C555X" as FiscalCode;

const trackEventMock = vi.spyOn(appinsights, "trackEvent");

describe("Session Service#userHasActiveSessionsOrLV", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const deps = {
    FastRedisClientTask: RedisClientTaskMock,
    SafeRedisClientTask: RedisClientTaskMock,
    RedisRepository: RedisRepositoryMock,
  };

  it.each`
    title         | active
    ${"active"}   | ${true}
    ${"inactive"} | ${false}
  `("should succeed with an $title session", async ({ active }) => {
    mockUserHasActiveSessionsOrLV.mockReturnValueOnce(TE.right(active));

    const result = await SessionService.getUserSession(aFiscalCode)(deps)();

    expect(mockUserHasActiveSessionsOrLV).toHaveBeenCalledTimes(1);
    expect(result).toEqual(E.right({ active }));
  });

  it("should error if userHasActiveSessionsOrLV fails", async () => {
    const customError = Error("custom error");
    mockUserHasActiveSessionsOrLV.mockReturnValueOnce(TE.left(customError));
    const result = await SessionService.getUserSession(aFiscalCode)(deps)();

    expect(mockUserHasActiveSessionsOrLV).toHaveBeenCalledTimes(1);
    expect(result).toEqual(E.left(customError));
  });
});

describe("Session Service#lockUserAuthentication", () => {
  const frozenDate = new Date(2025, 5, 1, 0, 0, 0);
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ now: frozenDate });
  });

  const deps = {
    FastRedisClientTask: RedisClientTaskMock,
    SafeRedisClientTask: RedisClientTaskMock,
    RedisRepository: RedisRepositoryMock,

    AuthLockRepository: AuthLockRepositoryMock,
    AuthenticationLockTableClient: {} as TableClient,
    LollipopRepository: LollipopRepositoryMock,
    RevokeAssertionRefQueueClient: {} as QueueClient,
    InstallationRepository: InstallationRepositoryMock,
    NotificationQueueClient: {} as QueueClient,
    AuthSessionsTopicRepository: AuthSessionsTopicRepositoryMock,
    authSessionsTopicSender: ServiceBusSenderMock,
  };

  it("should succeed to lock an user authentication and raise an event, when user is eligible", async () => {
    const result = await SessionService.lockUserAuthentication(
      aFiscalCode,
      anUnlockCode,
    )(deps)();

    expect(mockGetLollipopAssertionRefForUser).toHaveBeenCalledTimes(1);
    expect(mockfireAndForgetRevokeAssertionRef).toHaveBeenCalledTimes(1);
    expect(mockDelLollipopDataForUser).toHaveBeenCalledTimes(1);
    expect(mockDelUserAllSessions).toHaveBeenCalledTimes(1);
    expect(mockEmitSessionEvent).toHaveBeenCalledTimes(1);
    expect(mockEmitSessionEvent).toHaveBeenCalledWith({
      fiscalCode: aFiscalCode,
      eventType: EventTypeEnum.LOGOUT,
      scenario: LogoutScenarioEnum.AUTH_LOCK,
      ts: frozenDate,
    });
    expect(trackEventMock).not.toHaveBeenCalled();
    expect(result).toEqual(E.right(null));
  });

  it("should write a new applicationInsight customEvent, when an error occurs while emitting a serviceBus logout event on lock user", async () => {
    const anErrorMessage = "Simulated Error";
    const expectedError = toGenericError(anErrorMessage);

    mockEmitSessionEvent.mockImplementationOnce(() =>
      RTE.left(new Error(anErrorMessage)),
    );

    const expectedEventData: LogoutEvent = {
      fiscalCode: aFiscalCode,
      eventType: EventTypeEnum.LOGOUT,
      scenario: LogoutScenarioEnum.AUTH_LOCK,
      ts: frozenDate,
    };

    const result = await SessionService.lockUserAuthentication(
      aFiscalCode,
      anUnlockCode,
    )(deps)();

    expect(mockGetLollipopAssertionRefForUser).toHaveBeenCalledTimes(1);
    expect(mockfireAndForgetRevokeAssertionRef).toHaveBeenCalledTimes(1);
    expect(mockDelLollipopDataForUser).toHaveBeenCalledTimes(1);
    expect(mockDelUserAllSessions).toHaveBeenCalledTimes(1);
    expect(mockEmitSessionEvent).toHaveBeenCalledTimes(1);
    expect(mockEmitSessionEvent).toHaveBeenCalledWith(expectedEventData);
    expect(trackEventMock).toHaveBeenCalledOnce();
    expect(trackEventMock).toHaveBeenCalledWith({
      name: "service-bus.auth-event.emission-failure",
      properties: {
        eventData: expectedEventData,
        message: anErrorMessage,
      },
      tagOverrides: {
        samplingEnabled: "false",
      },
    });
    expect(result).toEqual(E.left(expectedError));
  });

  it("should succeed to lock an user authentication with no assertionref for the user", async () => {
    mockGetLollipopAssertionRefForUser.mockReturnValueOnce(TE.right(O.none));
    const result = await SessionService.lockUserAuthentication(
      aFiscalCode,
      anUnlockCode,
    )(deps)();

    expect(mockGetLollipopAssertionRefForUser).toHaveBeenCalledTimes(1);
    expect(mockfireAndForgetRevokeAssertionRef).not.toHaveBeenCalled();
    expect(mockDelLollipopDataForUser).toHaveBeenCalledTimes(1);
    expect(mockDelUserAllSessions).toHaveBeenCalledTimes(1);
    expect(mockEmitSessionEvent).toHaveBeenCalledTimes(1);
    expect(mockEmitSessionEvent).toHaveBeenCalledWith({
      fiscalCode: aFiscalCode,
      eventType: EventTypeEnum.LOGOUT,
      scenario: LogoutScenarioEnum.AUTH_LOCK,
      ts: frozenDate,
    });
    expect(result).toEqual(E.right(null));
  });

  it("should fail when redis is not available", async () => {
    const anErrorMessage = "ERROR";
    const expectedError = toGenericError(
      `Could not establish connection to redis: ${anErrorMessage}`,
    );
    const result = await SessionService.lockUserAuthentication(
      aFiscalCode,
      anUnlockCode,
    )({
      ...deps,
      FastRedisClientTask: TE.left(Error(anErrorMessage)),
    })();
    expect(mockEmitSessionEvent).not.toHaveBeenCalled();
    expect(result).toEqual(E.left(expectedError));
  });

  it("should fail when the lock can't be retrieved", async () => {
    const anError = Error("ERROR");
    const expectedError = toGenericError(
      "Something went wrong while checking the user authentication lock",
    );
    mockIsUserAuthenticationLocked.mockReturnValueOnce(RTE.left(anError));
    const result = await SessionService.lockUserAuthentication(
      aFiscalCode,
      anUnlockCode,
    )(deps)();

    expect(mockIsUserAuthenticationLocked).toHaveBeenCalledTimes(1);
    expect(mockEmitSessionEvent).not.toHaveBeenCalled();
    expect(result).toEqual(E.left(expectedError));
  });

  it("should fail and return conflict when a lock is already present", async () => {
    const expectedError = toConflictError(
      "Another user authentication lock has already been applied",
    );
    mockIsUserAuthenticationLocked.mockReturnValueOnce(RTE.right(true));
    const result = await SessionService.lockUserAuthentication(
      aFiscalCode,
      anUnlockCode,
    )(deps)();
    expect(mockIsUserAuthenticationLocked).toHaveBeenCalledTimes(1);
    expect(mockEmitSessionEvent).not.toHaveBeenCalled();
    expect(result).toEqual(E.left(expectedError));
  });

  it("should return generic error when assertionref retrieval fails", async () => {
    const anError = Error("ERROR");
    const expectedError = toGenericError(anError.message);
    mockGetLollipopAssertionRefForUser.mockReturnValueOnce(TE.left(anError));

    const result = await SessionService.lockUserAuthentication(
      aFiscalCode,
      anUnlockCode,
    )(deps)();

    expect(mockGetLollipopAssertionRefForUser).toHaveBeenCalledTimes(1);
    expect(mockEmitSessionEvent).not.toHaveBeenCalled();
    expect(result).toEqual(E.left(expectedError));
  });

  it("should return generic error when delete of lollipopdata fails", async () => {
    const anError = Error("ERROR");
    const expectedError = toGenericError(anError.message);
    mockDelLollipopDataForUser.mockReturnValueOnce(TE.left(anError));

    const result = await SessionService.lockUserAuthentication(
      aFiscalCode,
      anUnlockCode,
    )(deps)();

    expect(mockDelLollipopDataForUser).toHaveBeenCalledTimes(1);
    expect(mockEmitSessionEvent).not.toHaveBeenCalled();
    expect(result).toEqual(E.left(expectedError));
  });

  it("should return generic error when delete of all sessions fails", async () => {
    const anError = Error("ERROR");
    const expectedError = toGenericError(anError.message);
    mockDelUserAllSessions.mockReturnValueOnce(TE.left(anError));

    const result = await SessionService.lockUserAuthentication(
      aFiscalCode,
      anUnlockCode,
    )(deps)();

    expect(mockDelUserAllSessions).toHaveBeenCalledTimes(1);
    expect(mockEmitSessionEvent).not.toHaveBeenCalled();
    expect(result).toEqual(E.left(expectedError));
  });

  it("should return generic error when the installation clear fails", async () => {
    const anError = Error("ERROR");
    const expectedError = toGenericError(
      `Cannot delete Notification Installation: ${anError.message}`,
    );
    mockDeleteInstallation.mockReturnValueOnce(RTE.left(anError));

    const result = await SessionService.lockUserAuthentication(
      aFiscalCode,
      anUnlockCode,
    )(deps)();

    expect(mockDeleteInstallation).toHaveBeenCalledTimes(1);
    expect(mockEmitSessionEvent).not.toHaveBeenCalled();
    expect(result).toEqual(E.left(expectedError));
  });

  it("should return generic error when the lock action fails", async () => {
    const anError = Error("ERROR");
    const expectedError = toGenericError(anError.message);
    mockLockUserAuthentication.mockReturnValueOnce(RTE.left(anError));

    const result = await SessionService.lockUserAuthentication(
      aFiscalCode,
      anUnlockCode,
    )(deps)();

    expect(mockLockUserAuthentication).toHaveBeenCalledTimes(1);
    expect(mockEmitSessionEvent).not.toHaveBeenCalled();
    expect(result).toEqual(E.left(expectedError));
  });
});

describe("Session Service#unlockUserAuthentication", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const deps = {
    AuthLockRepository: AuthLockRepositoryMock,
    AuthenticationLockTableClient: {} as TableClient,
  };
  const aValidRequest = {
    params: { fiscal_code: aFiscalCode },
    body: { unlock_code: anUnlockCode },
  };
  const aValidRequestWithoutUnlockCode = {
    params: { fiscal_code: aFiscalCode },
    body: {},
  };

  it.each`
    title                                      | request
    ${"request contains unlock code"}          | ${aValidRequest}
    ${"request does NOT contains unlock code"} | ${aValidRequestWithoutUnlockCode}
  `(
    "should succeed releasing CF-unlockcode when user authentication is locked and $title",
    async ({ request }) => {
      mockGetUserAuthenticationLocks.mockReturnValueOnce(
        RTE.of([
          aNotReleasedData,
          { ...aNotReleasedData, rowKey: anotherUnlockCode },
        ]),
      );

      const result = await SessionService.unlockUserAuthentication(
        request.params.fiscal_code,
        request.body.unlock_code,
      )(deps)();

      expect(result).toEqual(E.right(null));

      expect(mockGetUserAuthenticationLocks).toHaveBeenCalledWith(aFiscalCode);
      expect(mockUnlockUserAuthentication).toHaveBeenCalledWith(
        aFiscalCode,
        "unlock_code" in request.body
          ? [request.body.unlock_code]
          : [anUnlockCode, anotherUnlockCode],
      );
    },
  );

  it.each`
    title                                      | request
    ${"request contains unlock code"}          | ${aValidRequest}
    ${"request does NOT contains unlock code"} | ${aValidRequestWithoutUnlockCode}
  `(
    "should succeed releasing CF-unlockcode when $title and query returns no records",
    // This can occur in cases where there is either no user authentication lock or when an invalid unlock code has been provided.
    async ({ request }) => {
      mockGetUserAuthenticationLocks.mockReturnValueOnce(RTE.right([]));
      const result = await SessionService.unlockUserAuthentication(
        request.params.fiscal_code,
        request.body.unlock_code,
      )(deps)();

      expect(result).toEqual(E.right(null));

      expect(mockGetUserAuthenticationLocks).toHaveBeenCalledTimes(1);
      expect(mockUnlockUserAuthentication).not.toHaveBeenCalled();
    },
  );

  it("should return Forbidden releasing CF-unlockcode when unlock code does not match", async () => {
    // This can occur in cases where there is either no user authentication lock or when an invalid unlock code has been provided.
    mockGetUserAuthenticationLocks.mockReturnValueOnce(
      RTE.right([{ ...aNotReleasedData, rowKey: anotherUnlockCode }]),
    );

    const result = await SessionService.unlockUserAuthentication(
      aValidRequest.params.fiscal_code,
      aValidRequest.body.unlock_code,
    )(deps)();

    expect(result).toEqual(E.left(forbiddenError));

    expect(mockGetUserAuthenticationLocks).toHaveBeenCalled();
    expect(mockUnlockUserAuthentication).not.toHaveBeenCalled();
  });

  it("should return GenericError when an error occurred retrieving user authentication lock data", async () => {
    mockGetUserAuthenticationLocks.mockReturnValueOnce(
      RTE.left(Error("an Error")),
    );
    const expectedError = toGenericError(
      "Something went wrong while checking the user authentication lock",
    );

    const result = await SessionService.unlockUserAuthentication(
      aValidRequest.params.fiscal_code,
      aValidRequest.body.unlock_code,
    )(deps)();

    expect(result).toEqual(E.left(expectedError));

    expect(mockUnlockUserAuthentication).not.toHaveBeenCalled();
  });

  it("should return GenericError when an error occurred releasing authentication lock", async () => {
    mockGetUserAuthenticationLocks.mockReturnValueOnce(
      RTE.of([aNotReleasedData]),
    );

    mockUnlockUserAuthentication.mockReturnValueOnce(
      RTE.left(Error("an Error")),
    );
    const expectedError = toGenericError(
      "Error releasing user authentication lock",
    );

    const result = await SessionService.unlockUserAuthentication(
      aValidRequest.params.fiscal_code,
      aValidRequest.body.unlock_code,
    )(deps)();

    expect(result).toEqual(E.left(expectedError));

    expect(mockGetUserAuthenticationLocks).toHaveBeenCalledTimes(1);
    expect(mockUnlockUserAuthentication).toHaveBeenCalledTimes(1);
  });
});

describe("Session Service#deleteUserSession", () => {
  const frozenDate = new Date(2025, 5, 1, 0, 0, 0);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ now: frozenDate });
  });

  const deps = {
    FastRedisClientTask: RedisClientTaskMock,
    SafeRedisClientTask: RedisClientTaskMock,
    RedisRepository: RedisRepositoryMock,
    LollipopRepository: LollipopRepositoryMock,
    RevokeAssertionRefQueueClient: {} as QueueClient,
    AuthSessionsTopicRepository: AuthSessionsTopicRepositoryMock,
    authSessionsTopicSender: ServiceBusSenderMock,
  };
  it("should succeed deleting an user session", async () => {
    const result = await SessionService.deleteUserSession(aFiscalCode)(deps)();

    expect(mockGetLollipopAssertionRefForUser).toHaveBeenCalledTimes(1);
    expect(mockfireAndForgetRevokeAssertionRef).toHaveBeenCalledTimes(1);
    expect(mockDelLollipopDataForUser).toHaveBeenCalledTimes(1);
    expect(mockDelUserAllSessions).toHaveBeenCalledTimes(1);
    expect(mockEmitSessionEvent).toHaveBeenCalledTimes(1);
    expect(mockEmitSessionEvent).toHaveBeenCalledWith({
      fiscalCode: aFiscalCode,
      eventType: EventTypeEnum.LOGOUT,
      scenario: LogoutScenarioEnum.WEB,
      ts: frozenDate,
    });
    expect(trackEventMock).not.toHaveBeenCalled();
    expect(result).toEqual(E.right(null));
  });

  it("should write an ApplicationInsights customEvent, when a failure emitting the logout event fails(deleting an user session)", async () => {
    const anErrorMessage = "Simulated Error";
    const expectedError = toGenericError(anErrorMessage);

    mockEmitSessionEvent.mockImplementationOnce(() =>
      RTE.left(new Error(anErrorMessage)),
    );

    const expectedEventData: LogoutEvent = {
      fiscalCode: aFiscalCode,
      eventType: EventTypeEnum.LOGOUT,
      scenario: LogoutScenarioEnum.WEB,
      ts: frozenDate,
    };

    const result = await SessionService.deleteUserSession(aFiscalCode)(deps)();

    expect(mockGetLollipopAssertionRefForUser).toHaveBeenCalledTimes(1);
    expect(mockfireAndForgetRevokeAssertionRef).toHaveBeenCalledTimes(1);
    expect(mockDelLollipopDataForUser).toHaveBeenCalledTimes(1);
    expect(mockDelUserAllSessions).toHaveBeenCalledTimes(1);
    expect(mockEmitSessionEvent).toHaveBeenCalledTimes(1);
    expect(mockEmitSessionEvent).toHaveBeenCalledWith(expectedEventData);
    expect(trackEventMock).toHaveBeenCalledWith({
      name: "service-bus.auth-event.emission-failure",
      properties: {
        eventData: expectedEventData,
        message: anErrorMessage,
      },
      tagOverrides: {
        samplingEnabled: "false",
      },
    });
    expect(trackEventMock).toHaveBeenCalledOnce();
    expect(result).toEqual(E.left(expectedError));
  });

  it("should succeed deleting an user session with no assertionref", async () => {
    mockGetLollipopAssertionRefForUser.mockReturnValueOnce(TE.right(O.none));
    const result = await SessionService.deleteUserSession(aFiscalCode)(deps)();

    expect(mockGetLollipopAssertionRefForUser).toHaveBeenCalledTimes(1);
    expect(mockfireAndForgetRevokeAssertionRef).not.toHaveBeenCalled();
    expect(mockDelLollipopDataForUser).toHaveBeenCalledTimes(1);
    expect(mockDelUserAllSessions).toHaveBeenCalledTimes(1);
    expect(mockEmitSessionEvent).toHaveBeenCalledTimes(1);
    expect(mockEmitSessionEvent).toHaveBeenCalledWith({
      fiscalCode: aFiscalCode,
      eventType: EventTypeEnum.LOGOUT,
      scenario: LogoutScenarioEnum.WEB,
      ts: frozenDate,
    });
    expect(trackEventMock).not.toHaveBeenCalled();
    expect(result).toEqual(E.right(null));
  });

  it("should fail when redis is not available", async () => {
    const anErrorMessage = "ERROR";
    const expectedError = toGenericError(
      `Could not establish connection to redis: ${anErrorMessage}`,
    );
    const result = await SessionService.deleteUserSession(aFiscalCode)({
      ...deps,
      FastRedisClientTask: TE.left(Error(anErrorMessage)),
    })();

    expect(mockEmitSessionEvent).not.toHaveBeenCalled();
    expect(trackEventMock).not.toHaveBeenCalled();
    expect(result).toEqual(E.left(expectedError));
  });

  it("should return generic error when assertionref retrieval fails", async () => {
    const anError = Error("ERROR");
    const expectedError = toGenericError(anError.message);
    mockGetLollipopAssertionRefForUser.mockReturnValueOnce(TE.left(anError));

    const result = await SessionService.deleteUserSession(aFiscalCode)(deps)();

    expect(mockGetLollipopAssertionRefForUser).toHaveBeenCalledTimes(1);
    expect(mockEmitSessionEvent).not.toHaveBeenCalled();
    expect(trackEventMock).not.toHaveBeenCalled();
    expect(result).toEqual(E.left(expectedError));
  });

  it("should return generic error when delete of lollipopdata fails", async () => {
    const anError = Error("ERROR");
    const expectedError = toGenericError(anError.message);
    mockDelLollipopDataForUser.mockReturnValueOnce(TE.left(anError));

    const result = await SessionService.deleteUserSession(aFiscalCode)(deps)();

    expect(mockDelLollipopDataForUser).toHaveBeenCalledTimes(1);
    expect(mockEmitSessionEvent).not.toHaveBeenCalled();
    expect(trackEventMock).not.toHaveBeenCalled();
    expect(result).toEqual(E.left(expectedError));
  });

  it("should return generic error when delete of all sessions fails", async () => {
    const anError = Error("ERROR");
    const expectedError = toGenericError(anError.message);
    mockDelUserAllSessions.mockReturnValueOnce(TE.left(anError));

    const result = await SessionService.deleteUserSession(aFiscalCode)(deps)();

    expect(mockDelUserAllSessions).toHaveBeenCalledTimes(1);
    expect(mockEmitSessionEvent).not.toHaveBeenCalled();
    expect(trackEventMock).not.toHaveBeenCalled();
    expect(result).toEqual(E.left(expectedError));
  });
});

describe("Session Service#getUserSessionState", () => {
  const aTTL = 123;
  const frozenDate = new Date(2025, 5, 1, 0, 0, 0);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ now: frozenDate });
  });

  const deps = {
    SafeRedisClientTask: RedisClientTaskMock,
    RedisRepository: RedisRepositoryMock,
    AuthLockRepository: AuthLockRepositoryMock,
    AuthenticationLockTableClient: {} as TableClient,
  };

  it("should return success if an unlocked session exists", async () => {
    mockGetSessionRemainingTTL.mockReturnValueOnce(
      TE.right(O.some({ ttl: aTTL, type: LoginTypeEnum.LV })),
    );
    const result =
      await SessionService.getUserSessionState(aFiscalCode)(deps)();

    expect(mockIsUserAuthenticationLocked).toHaveBeenCalledTimes(1);
    expect(mockGetSessionRemainingTTL).toHaveBeenCalledTimes(1);
    expect(result).toEqual(
      E.right({
        ...anUnlockedUserSessionState,
        session_info: {
          active: true,
          expiration_date: addSeconds(frozenDate, aTTL).toISOString(),
          type: LoginTypeEnum.LV,
        },
      }),
    );
  });

  it("should return success if a locked session exists", async () => {
    mockIsUserAuthenticationLocked.mockReturnValueOnce(RTE.right(true));

    const result =
      await SessionService.getUserSessionState(aFiscalCode)(deps)();

    expect(mockIsUserAuthenticationLocked).toHaveBeenCalledTimes(1);
    expect(mockGetSessionRemainingTTL).toHaveBeenCalledTimes(1);
    expect(result).toEqual(
      E.right({
        access_enabled: false,
        session_info: {
          active: true,
          expiration_date: addSeconds(frozenDate, aTTL).toISOString(),
          type: LoginTypeEnum.LV,
        },
      }),
    );
  });

  it("should return success if a session doesn't exist", async () => {
    mockGetSessionRemainingTTL.mockReturnValueOnce(TE.right(O.none));

    const result =
      await SessionService.getUserSessionState(aFiscalCode)(deps)();

    expect(mockIsUserAuthenticationLocked).toHaveBeenCalledTimes(1);
    expect(mockGetSessionRemainingTTL).toHaveBeenCalledTimes(1);
    expect(result).toEqual(
      E.right({
        access_enabled: true,
        session_info: {
          active: false,
        },
      }),
    );
  });

  it("should fail if an error occours on redis initialization", async () => {
    const anErrorMessage = "an error";

    const result = await SessionService.getUserSessionState(aFiscalCode)({
      ...deps,
      SafeRedisClientTask: TE.left(Error(anErrorMessage)),
    })();

    expect(result).toEqual(
      E.left(
        toGenericError(
          `Could not establish connection to redis: ${anErrorMessage}`,
        ),
      ),
    );
  });

  it("should fail if an error occours reading the session lock state", async () => {
    const anErrorMessage = "an error";
    mockIsUserAuthenticationLocked.mockReturnValueOnce(
      RTE.left(new Error(anErrorMessage)),
    );

    const result =
      await SessionService.getUserSessionState(aFiscalCode)(deps)();

    expect(result).toEqual(
      E.left(
        toGenericError(`Error reading the auth lock info: [${anErrorMessage}]`),
      ),
    );
  });

  it("should fail if an error occours reading the session TTL", async () => {
    const anErrorMessage = "an error";
    mockGetSessionRemainingTTL.mockReturnValueOnce(
      TE.left(new Error(anErrorMessage)),
    );

    const result =
      await SessionService.getUserSessionState(aFiscalCode)(deps)();
    expect(result).toEqual(
      E.left(
        toGenericError(`Error reading the session info: [${anErrorMessage}]`),
      ),
    );
  });
});
