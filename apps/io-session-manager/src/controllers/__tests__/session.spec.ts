/* eslint-disable max-lines-per-function */
import { EventTypeEnum } from "@pagopa/io-auth-n-identity-commons/types/session-event/event-type";
import {
  LogoutEvent,
  LogoutScenarioEnum,
} from "@pagopa/io-auth-n-identity-commons/types/session-event/logout-event";
import { ResponseSuccessJson } from "@pagopa/ts-commons/lib/responses";
import { withoutUndefinedValues } from "@pagopa/ts-commons/lib/types";
import crypto from "crypto";
import { addSeconds } from "date-fns";
import { Request, Response } from "express";
import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/lib/function";
import * as O from "fp-ts/Option";
import * as RTE from "fp-ts/ReaderTaskEither";
import * as TE from "fp-ts/TaskEither";
import { afterAll, beforeEach, describe, expect, test, vi } from "vitest";
import { mockedAppinsightsTelemetryClient } from "../../__mocks__/appinsights.mocks";
import { anAssertionRef } from "../../__mocks__/lollipop.mocks";
import { mockGet, mockRedisClientSelector } from "../../__mocks__/redis.mocks";
import mockReq from "../../__mocks__/request.mocks";
import mockRes from "../../__mocks__/response.mocks";
import { mockServiceBusSender } from "../../__mocks__/service-bus-sender.mocks";
import {
  mockRevokeAssertionRefAssociation,
  mockedLollipopService,
} from "../../__mocks__/services/lollipopService.mocks";
import {
  mockDeleteUser,
  mockGetLollipopAssertionRefForUser,
  mockedRedisSessionStorageService,
} from "../../__mocks__/services/redisSessionStorageService.mocks";
import {
  mockedInitializedProfile,
  mockedUser,
} from "../../__mocks__/user.mocks";
import { toExpectedResponse } from "../../__tests__/utils";
import { UserIdentityWithTtl } from "../../generated/introspection/UserIdentityWithTtl";
import { mockAuthSessionsTopicRepository } from "../../repositories/__mocks__/auth-session-topic-repository.mocks";
import { FnAppAPIClient } from "../../repositories/fn-app-api";
import { LollipopApiClient } from "../../repositories/lollipop-api";
import { RedisSessionStorageService, TokenService } from "../../services";
import * as profileService from "../../services/profile";
import { RedisClientSelectorType } from "../../types/redis";
import { getSessionState, getUserIdentity, logout } from "../session";

const frozenDate = new Date(2025, 0, 1);
vi.setSystemTime(frozenDate);

afterAll(() => {
  vi.useRealTimers();
});

describe("getSessionState", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const res = mockRes() as unknown as Response;
  const req = mockReq() as unknown as Request;

  const mockGetProfile = vi.spyOn(profileService, "getProfile");
  mockGetProfile.mockReturnValue(
    TE.of(ResponseSuccessJson(mockedInitializedProfile)),
  );

  const zendeskSuffixForCorrectlyRetrievedProfile = crypto
    .createHash("sha256")
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    .update(mockedInitializedProfile.email!)
    .digest("hex")
    .substring(0, 8);

  const aZendeskSuffix = "abcd";

  const mockGetNewTokenAsync = vi
    .spyOn(TokenService, "getNewTokenAsync")
    .mockResolvedValue(aZendeskSuffix);

  const ttlStandard = 3600;
  const mockGetSessionTtl = vi.spyOn(
    RedisSessionStorageService,
    "getSessionTtl",
  );
  mockGetSessionTtl.mockReturnValue(() => TE.right(ttlStandard));
  const expectedExpirationDateStandard = addSeconds(
    new Date(),
    ttlStandard,
  ).toISOString();

  const ttlFast = 1800;
  const mockGetSessionRemainingTtlFast = vi.spyOn(
    RedisSessionStorageService,
    "getSessionRemainingTtlFast",
  );
  mockGetSessionRemainingTtlFast.mockReturnValue(TE.right(O.some(ttlFast)));
  const expectedExpirationDateFast = addSeconds(
    new Date(),
    ttlFast,
  ).toISOString();

  test("GIVEN a valid request WHEN lollipop is initialized for the user THEN it should return a correct session state", async () => {
    mockGet.mockResolvedValueOnce(anAssertionRef);

    await pipe(
      {
        fnAppAPIClient: {} as ReturnType<typeof FnAppAPIClient>,
        redisClientSelector: mockRedisClientSelector,
        req,
        user: mockedUser,
      },
      getSessionState,
      TE.map((response) => response.apply(res)),
      TE.mapLeft((err) => expect(err).toBeFalsy()),
    )();

    expect(mockGet).toBeCalledWith(`KEYS-${mockedUser.fiscal_code}`);
    expect(mockGetSessionTtl).not.toHaveBeenCalled();
    // mockedInitializedProfile has the email validated, a new zendesksuffix
    // would not be created
    expect(mockGetNewTokenAsync).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      bpdToken: mockedUser.bpd_token,
      fimsToken: mockedUser.fims_token,
      myPortalToken: mockedUser.myportal_token,
      spidLevel: mockedUser.spid_level,
      walletToken: mockedUser.wallet_token,
      zendeskToken: `${mockedUser.zendesk_token}${zendeskSuffixForCorrectlyRetrievedProfile}`,
      lollipopAssertionRef: anAssertionRef,
      expirationDate: expectedExpirationDateFast,
    });
  });

  test("GIVEN a valid request WHEN lollipop is NOT initialized for the user THEN it should return a correct session state", async () => {
    mockGet.mockResolvedValueOnce(null);
    mockGetSessionRemainingTtlFast.mockReturnValueOnce(TE.right(O.none));

    await pipe(
      {
        fnAppAPIClient: {} as ReturnType<typeof FnAppAPIClient>,
        redisClientSelector: mockRedisClientSelector,
        req,
        user: mockedUser,
      },
      getSessionState,
      TE.map((response) => response.apply(res)),
      TE.mapLeft((err) => expect(err).toBeFalsy()),
    )();

    expect(mockGet).toBeCalledWith(`KEYS-${mockedUser.fiscal_code}`);
    expect(mockGetSessionTtl).toHaveBeenCalledOnce();
    // mockedInitializedProfile has the email validated, a new zendesksuffix
    // would not be created
    expect(mockGetNewTokenAsync).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      bpdToken: mockedUser.bpd_token,
      fimsToken: mockedUser.fims_token,
      myPortalToken: mockedUser.myportal_token,
      spidLevel: mockedUser.spid_level,
      walletToken: mockedUser.wallet_token,
      zendeskToken: `${mockedUser.zendesk_token}${zendeskSuffixForCorrectlyRetrievedProfile}`,
      expirationDate: expectedExpirationDateStandard,
    });
  });

  test("GIVEN a valid request WHEN an error occurs retrieving the assertion ref THEN it should return an InternalServerError", async () => {
    const expectedError = new Error("Error retrieving the assertion ref");
    mockGet.mockRejectedValueOnce(expectedError);

    await pipe(
      {
        fnAppAPIClient: {} as ReturnType<typeof FnAppAPIClient>,
        redisClientSelector: mockRedisClientSelector,
        req,
        user: mockedUser,
      },
      getSessionState,
      TE.map((response) => response.apply(res)),
      TE.mapLeft((err) => expect(err).toBeFalsy()),
    )();

    expect(mockGet).toBeCalledWith(`KEYS-${mockedUser.fiscal_code}`);
    expect(mockGetNewTokenAsync).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: expect.stringContaining(expectedError.message),
        status: 500,
        title: "Internal server error",
      }),
    );
  });

  test("GIVEN a valid request WHEN the user logged without lollipop key THEN it should return a correct session state with the standard login TTL", async () => {
    mockGet.mockResolvedValueOnce(null);
    mockGetSessionRemainingTtlFast.mockReturnValueOnce(TE.right(O.none));

    await pipe(
      {
        fnAppAPIClient: {} as ReturnType<typeof FnAppAPIClient>,
        redisClientSelector: mockRedisClientSelector,
        req,
        user: mockedUser,
      },
      getSessionState,
      TE.map((response) => response.apply(res)),
      TE.mapLeft((err) => expect(err).toBeFalsy()),
    )();

    expect(mockGet).toBeCalledWith(`KEYS-${mockedUser.fiscal_code}`);
    expect(mockGetSessionTtl).toHaveBeenCalledOnce();

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      bpdToken: mockedUser.bpd_token,
      fimsToken: mockedUser.fims_token,
      myPortalToken: mockedUser.myportal_token,
      spidLevel: mockedUser.spid_level,
      walletToken: mockedUser.wallet_token,
      zendeskToken: `${mockedUser.zendesk_token}${zendeskSuffixForCorrectlyRetrievedProfile}`,
      expirationDate: expectedExpirationDateStandard,
    });
  });

  test("GIVEN a valid request WHEN an error occurs retrieving the user profile THEN it should return a correct session state", async () => {
    const expectedError = new Error("Network Error");
    mockGetProfile.mockReturnValueOnce(TE.left(expectedError));
    mockGet.mockResolvedValueOnce(anAssertionRef);

    await pipe(
      {
        fnAppAPIClient: {} as ReturnType<typeof FnAppAPIClient>,
        redisClientSelector: mockRedisClientSelector,
        req,
        user: mockedUser,
      },
      getSessionState,
      TE.map((response) => response.apply(res)),
      TE.mapLeft((err) => expect(err).toBeFalsy()),
    )();

    expect(mockGet).toBeCalledWith(`KEYS-${mockedUser.fiscal_code}`);
    // a new zendesk suffix should be generated
    expect(mockGetNewTokenAsync).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      bpdToken: mockedUser.bpd_token,
      fimsToken: mockedUser.fims_token,
      myPortalToken: mockedUser.myportal_token,
      spidLevel: mockedUser.spid_level,
      walletToken: mockedUser.wallet_token,
      zendeskToken: `${mockedUser.zendesk_token}${aZendeskSuffix}`,
      lollipopAssertionRef: anAssertionRef,
      expirationDate: expectedExpirationDateFast,
    });
  });

  test("GIVEN a valid request WHEN a filter is provided THEN it should return only requested fields", async () => {
    const aValidFilterReq = mockReq({
      query: { fields: "(zendeskToken,walletToken)" },
    }) as unknown as Request;

    await pipe(
      {
        fnAppAPIClient: {} as ReturnType<typeof FnAppAPIClient>,
        redisClientSelector: mockRedisClientSelector,
        req: aValidFilterReq,
        user: mockedUser,
      },
      getSessionState,
      TE.map((response) => response.apply(res)),
      TE.mapLeft((err) => expect(err).toBeFalsy()),
    )();

    // computation should be avoided since we are not including
    // lollipopAssertionRef in the filter
    expect(mockGet).not.toHaveBeenCalled();
    // mockedInitializedProfile has the email validated
    expect(mockGetNewTokenAsync).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      walletToken: mockedUser.wallet_token,
      zendeskToken: `${mockedUser.zendesk_token}${zendeskSuffixForCorrectlyRetrievedProfile}`,
    });
  });

  test("GIVEN a valid user with email disabled WHEN a filter is provided THEN it should return only requested fields generating a new suffix", async () => {
    const aValidFilterReq = mockReq({
      query: { fields: "(zendeskToken,walletToken)" },
    }) as unknown as Request;

    // zendesk suffix is generated when an user doesn't have a validated email
    mockGetProfile.mockReturnValueOnce(
      TE.right(
        ResponseSuccessJson({
          ...mockedInitializedProfile,
          is_email_validated: false,
        }),
      ),
    );

    await pipe(
      {
        fnAppAPIClient: {} as ReturnType<typeof FnAppAPIClient>,
        redisClientSelector: mockRedisClientSelector,
        req: aValidFilterReq,
        user: mockedUser,
      },
      getSessionState,
      TE.map((response) => response.apply(res)),
      TE.mapLeft((err) => expect(err).toBeFalsy()),
    )();

    // computation should be avoided since we are not including
    // lollipopAssertionRef in the filter
    expect(mockGet).not.toHaveBeenCalled();
    expect(mockGetNewTokenAsync).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      walletToken: mockedUser.wallet_token,
      zendeskToken: `${mockedUser.zendesk_token}${aZendeskSuffix}`,
    });
  });

  test("GIVEN a valid request WHEN a filter has only wrong fields THEN it should return an empty object", async () => {
    const aValidFilterReq = mockReq({
      query: { fields: "(ZENDESK)" },
    }) as unknown as Request;

    await pipe(
      {
        fnAppAPIClient: {} as ReturnType<typeof FnAppAPIClient>,
        redisClientSelector: mockRedisClientSelector,
        req: aValidFilterReq,
        user: mockedUser,
      },
      getSessionState,
      TE.map((response) => response.apply(res)),
      TE.mapLeft((err) => expect(err).toBeFalsy()),
    )();

    // computation should be avoided since we are not including
    // lollipopAssertionRef in the filter
    expect(mockGet).not.toHaveBeenCalled();
    expect(mockGetNewTokenAsync).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({});
  });

  test("GIVEN a valid request WHEN a filter is provided with wrong fields THEN it should return only recognized fields", async () => {
    const aValidFilterReq = mockReq({
      query: {
        fields: "(ZENDESK_TOKEN,lollipopAssertionRef,spidLevel,SPID_LEVEL)",
      },
    }) as unknown as Request;

    mockGet.mockResolvedValueOnce(anAssertionRef);
    await pipe(
      {
        fnAppAPIClient: {} as ReturnType<typeof FnAppAPIClient>,
        redisClientSelector: mockRedisClientSelector,
        req: aValidFilterReq,
        user: mockedUser,
      },
      getSessionState,
      TE.map((response) => response.apply(res)),
      TE.mapLeft((err) => expect(err).toBeFalsy()),
    )();

    // computation should be avoided since we are not including
    // lollipopAssertionRef in the filter
    expect(mockGet).toHaveBeenCalledWith(`KEYS-${mockedUser.fiscal_code}`);
    expect(mockGetNewTokenAsync).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      spidLevel: mockedUser.spid_level,
      lollipopAssertionRef: anAssertionRef,
    });
  });

  test.each`
    scenario     | fields  | detail
    ${"wrong"}   | ${123}  | ${"Could not decode filter query param"}
    ${"invalid"} | ${"()"} | ${"Invalid filter query param"}
  `(
    "GIVEN a request WHEN a $scenario filter is provided THEN it should return a validation error",
    async ({ fields, detail }) => {
      const anInvalidFilterReq = mockReq({
        query: { fields },
      }) as unknown as Request;

      await pipe(
        {
          fnAppAPIClient: {} as ReturnType<typeof FnAppAPIClient>,
          redisClientSelector: mockRedisClientSelector,
          req: anInvalidFilterReq,
          user: mockedUser,
        },
        getSessionState,
        TE.map((response) => response.apply(res)),
        TE.mapLeft((err) => expect(err).toBeFalsy()),
      )();

      // computation should be avoided
      expect(mockGet).not.toHaveBeenCalled();
      expect(mockGetNewTokenAsync).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          detail,
          status: 400,
          title: "Validation error",
        }),
      );
    },
  );

  test("GIVEN a valid request WHEN an error happens generating zendesk suffix THEN it should return an internal error", async () => {
    const aValidFilterReq = mockReq({
      query: { fields: "(zendeskToken)" },
    }) as unknown as Request;
    const expectedError = Error("error");

    mockGetNewTokenAsync.mockRejectedValueOnce(expectedError);

    // zendesk suffix is generated when an user doesn't have a validated email
    mockGetProfile.mockReturnValueOnce(
      TE.right(
        ResponseSuccessJson({
          ...mockedInitializedProfile,
          is_email_validated: false,
        }),
      ),
    );

    await pipe(
      {
        fnAppAPIClient: {} as ReturnType<typeof FnAppAPIClient>,
        redisClientSelector: mockRedisClientSelector,
        req: aValidFilterReq,
        user: mockedUser,
      },
      getSessionState,
      TE.map((response) => response.apply(res)),
      TE.mapLeft((err) => expect(err).toBeFalsy()),
    )();

    // computation should be avoided
    expect(mockGet).not.toHaveBeenCalled();
    expect(mockGetNewTokenAsync).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: `Could not get opaque token: ${expectedError}`,
        status: 500,
        title: "Internal server error",
      }),
    );
  });

  test.each`
    scenario             | invalidStandardSessionTtl
    ${"does not exists"} | ${-2}
    ${"has no TTL"}      | ${-1}
  `(
    "GIVEN a valid request WHEN a Redis key $scenario THEN it should return an error",
    async ({ invalidStandardSessionTtl }) => {
      const aValidFilterReq = mockReq({
        query: { fields: "(expirationDate)" },
      }) as unknown as Request;

      mockGetSessionRemainingTtlFast.mockReturnValueOnce(TE.right(O.none));
      mockGetSessionTtl.mockReturnValueOnce(() =>
        TE.right(invalidStandardSessionTtl),
      );

      await pipe(
        {
          fnAppAPIClient: {} as ReturnType<typeof FnAppAPIClient>,
          redisClientSelector: mockRedisClientSelector,
          req: aValidFilterReq,
          user: mockedUser,
        },
        getSessionState,
        TE.map((response) => response.apply(res)),
        TE.mapLeft((err) => expect(err).toBeFalsy()),
      )();

      expect(mockGetSessionRemainingTtlFast).toHaveBeenCalledTimes(1);
      expect(mockGetSessionTtl).toHaveBeenCalledTimes(1);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: `Error retrieving the session TTL: Standard session TTL is negative: ${invalidStandardSessionTtl}`,
          status: 500,
          title: "Internal server error",
        }),
      );
    },
  );
});

describe("logout", () => {
  const mockEmitSessionEvent = vi.spyOn(
    mockAuthSessionsTopicRepository,
    "emitSessionEvent",
  );

  const expectedLogoutEvent: LogoutEvent = {
    eventType: EventTypeEnum.LOGOUT,
    fiscalCode: mockedUser.fiscal_code,
    scenario: LogoutScenarioEnum.APP,
    ts: frozenDate,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const req = mockReq() as unknown as Request;

  const mockedDependencies = {
    // Repositories are not used, since we mocked the service layer
    lollipopApiClient: {} as LollipopApiClient,
    redisClientSelector: {} as RedisClientSelectorType,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    lollipopRevokeQueueClient: {} as any,
    // Services
    lollipopService: mockedLollipopService,
    redisSessionStorageService: mockedRedisSessionStorageService,

    AuthSessionsTopicRepository: mockAuthSessionsTopicRepository,
    authSessionsTopicSender: mockServiceBusSender,
    appInsightsTelemetryClient: mockedAppinsightsTelemetryClient,

    user: mockedUser,
    req,
  };

  test(`
    GIVEN a valid request
    WHEN assertionRef exists on redis
    THEN it should send the pub key revokal message and succeed deleting the assertionRef and the session token`, async () => {
    const result = await logout(mockedDependencies)();

    expect(result).toEqual(
      E.right(toExpectedResponse(ResponseSuccessJson({ message: "ok" }))),
    );

    expect(mockGetLollipopAssertionRefForUser).toHaveBeenCalledWith({
      ...mockedDependencies,
      fiscalCode: mockedUser.fiscal_code,
    });
    expect(mockRevokeAssertionRefAssociation).toHaveBeenCalledWith(
      mockedUser.fiscal_code,
      anAssertionRef,
      "lollipop.error.logout",
      "logout from lollipop session",
    );
    expect(mockDeleteUser).toHaveBeenCalledWith(mockedUser);
    expect(mockEmitSessionEvent).toHaveBeenCalledWith(expectedLogoutEvent);
    expect(mockedAppinsightsTelemetryClient.trackEvent).not.toHaveBeenCalled();
  });

  test(`
    GIVEN a valid request
    WHEN there is no assertionRef on redis
    THEN it should NOT send the pub key revokal message and succeed deleting the assertionRef and the session token`, async () => {
    mockGetLollipopAssertionRefForUser.mockImplementationOnce((_deps) =>
      TE.of(O.none),
    );

    const result = await logout(mockedDependencies)();

    expect(result).toEqual(
      E.right(toExpectedResponse(ResponseSuccessJson({ message: "ok" }))),
    );

    expect(mockRevokeAssertionRefAssociation).not.toHaveBeenCalled();
    expect(mockDeleteUser).toHaveBeenCalledWith(mockedUser);
    expect(mockEmitSessionEvent).toHaveBeenCalledWith(expectedLogoutEvent);
    expect(mockedAppinsightsTelemetryClient.trackEvent).not.toHaveBeenCalled();
  });

  test(`
    GIVEN a valid request
    WHEN it can't retrieve the assertionRef from redis because of an error
    THEN it should fail not sending the pub key revokal message and not deleting the assertionRef and the session tokens`, async () => {
    mockGetLollipopAssertionRefForUser.mockImplementationOnce((_deps) =>
      TE.left(Error("getLollipopAssertionRefForUser Error")),
    );

    const result = await logout(mockedDependencies)();

    expect(result).toEqual(
      E.left(Error("getLollipopAssertionRefForUser Error")),
    );

    expect(mockRevokeAssertionRefAssociation).not.toHaveBeenCalled();
    expect(mockDeleteUser).not.toHaveBeenCalled();
    expect(mockEmitSessionEvent).not.toHaveBeenCalled();
    expect(mockedAppinsightsTelemetryClient.trackEvent).not.toHaveBeenCalled();
  });

  test(`
   GIVEN a valid request
   WHEN the assertionRef can not be destroyed
   THEN it should fail after sending the pub key revokal message but not deleting the session tokens`, async () => {
    mockRevokeAssertionRefAssociation.mockImplementationOnce(
      () => (_deps) => TE.right(false),
    );

    const result = await logout(mockedDependencies)();

    expect(result).toEqual(E.left(Error("Error revoking the AssertionRef")));

    expect(mockDeleteUser).not.toHaveBeenCalled();
    expect(mockEmitSessionEvent).not.toHaveBeenCalled();
    expect(mockedAppinsightsTelemetryClient.trackEvent).not.toHaveBeenCalled();
  });

  test(`
   GIVEN a valid request
   WHEN it can't delete the assertionRef from redis because of an error
   THEN it should fail after sending the pub key revokal message but not deleting the session tokens`, async () => {
    mockRevokeAssertionRefAssociation.mockImplementationOnce(
      () => (_deps) => TE.left(Error("revokeAssertionRefAssociation Error")),
    );

    const result = await logout(mockedDependencies)();

    expect(result).toEqual(
      E.left(Error("revokeAssertionRefAssociation Error")),
    );

    expect(mockDeleteUser).not.toHaveBeenCalled();
    expect(mockEmitSessionEvent).not.toHaveBeenCalled();
    expect(mockedAppinsightsTelemetryClient.trackEvent).not.toHaveBeenCalled();
  });

  test(`
  GIVEN an enabled lollipop flow
  WHEN the session can not be destroyed
  THEN it should fail after sending the pub key revokal message and deleting the assertionRef`, async () => {
    mockDeleteUser.mockImplementationOnce(
      () => (_deps) => TE.right(false as true), // force casting true
    );

    const result = await logout(mockedDependencies)();

    expect(result).toEqual(E.left(Error("Error destroying the user session")));

    expect(mockRevokeAssertionRefAssociation).toHaveBeenCalled();
    expect(mockEmitSessionEvent).not.toHaveBeenCalled();
    expect(mockedAppinsightsTelemetryClient.trackEvent).not.toHaveBeenCalled();
  });

  test(`
  GIVEN an enabled lollipop flow
  WHEN the Redis client returns an error
  THEN it should fail after sending the pub key revokal message and deleting the assertionRef`, async () => {
    mockDeleteUser.mockImplementationOnce(
      () => (_deps) => TE.left(Error("deleteUser error")),
    );

    const result = await logout(mockedDependencies)();

    expect(result).toEqual(E.left(Error("deleteUser error")));

    expect(mockRevokeAssertionRefAssociation).toHaveBeenCalled();
    expect(mockEmitSessionEvent).not.toHaveBeenCalled();
    expect(mockedAppinsightsTelemetryClient.trackEvent).not.toHaveBeenCalled();
  });

  test(`
    GIVEN a valid request
    WHEN a failure occurs while sending the serviceBus logout event
    THEN an applicationInsights customEvent should be sent containing all logout event data`, async () => {
    mockGetLollipopAssertionRefForUser.mockImplementationOnce((_deps) =>
      TE.of(O.none),
    );

    const simulatedError = new Error("Simulated Error");

    mockEmitSessionEvent.mockImplementationOnce(() => RTE.left(simulatedError));

    const result = await logout(mockedDependencies)();

    expect(result).toEqual(E.left(simulatedError));

    expect(mockRevokeAssertionRefAssociation).not.toHaveBeenCalled();
    expect(mockDeleteUser).toHaveBeenCalledWith(mockedUser);
    expect(mockEmitSessionEvent).toHaveBeenCalledWith(expectedLogoutEvent);
    expect(mockedAppinsightsTelemetryClient.trackEvent).toHaveBeenCalledOnce();
    expect(mockedAppinsightsTelemetryClient.trackEvent).toHaveBeenCalledWith({
      name: "service-bus.auth-event.emission-failure",
      properties: {
        eventData: expectedLogoutEvent,
        message: simulatedError.message,
      },
      tagOverrides: {
        samplingEnabled: "false",
      },
    });
  });
});

describe("getUserIdentity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const res = mockRes() as unknown as Response;
  const req = mockReq() as unknown as Request;

  const mockedDependencies = {
    redisClientSelector: mockRedisClientSelector,
    user: mockedUser,
    req,
  };
  const mockGetSessionTtl = vi.spyOn(
    RedisSessionStorageService,
    "getSessionTtl",
  );
  const mockGetLollipopAssertionRefForUser = vi.spyOn(
    RedisSessionStorageService,
    "getLollipopAssertionRefForUser",
  );

  test("GIVEN a valid lollipop session and token with positive TTL THEN it should return user identity with remaining TTL", async () => {
    // Arrange
    const expectedTtl = 3600; // 1 hour
    mockGetLollipopAssertionRefForUser.mockReturnValueOnce(
      TE.right(O.some(anAssertionRef)),
    );
    mockGetSessionTtl.mockReturnValueOnce(() => TE.right(expectedTtl));

    // Act
    await pipe(
      mockedDependencies,
      getUserIdentity,
      TE.map((response) => response.apply(res)),
      TE.mapLeft((err) => expect(err).toBeFalsy()),
    )();

    // Assert
    expect(mockGetLollipopAssertionRefForUser).toHaveBeenCalledWith({
      redisClientSelector: mockedDependencies.redisClientSelector,
      fiscalCode: mockedDependencies.user.fiscal_code,
    });
    expect(mockGetSessionTtl).toHaveBeenCalledWith(
      mockedDependencies.user.session_token,
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining(
        UserIdentityWithTtl.encode(
          withoutUndefinedValues({
            created_at: mockedUser.created_at,
            name: mockedUser.name,
            assertion_ref: anAssertionRef,
            family_name: mockedUser.family_name,
            spid_email: mockedUser.spid_email,
            date_of_birth: mockedUser.date_of_birth,
            fiscal_code: mockedUser.fiscal_code,
            spid_level: mockedUser.spid_level,
            spid_idp: mockedUser.spid_idp,
            session_tracking_id: mockedUser.session_tracking_id,
            token_remaining_ttl: expectedTtl,
          }),
        ),
      ),
    );
  });

  test("GIVEN a non lollipop session THEN it should not return assertion ref", async () => {
    mockGetLollipopAssertionRefForUser.mockReturnValueOnce(TE.right(O.none));
    mockGetSessionTtl.mockReturnValueOnce(() => TE.right(3600));
    // Act
    await pipe(
      mockedDependencies,
      getUserIdentity,
      TE.map((response) => response.apply(res)),
      TE.mapLeft((err) => expect(err).toBeFalsy()),
    )();

    expect(mockGetLollipopAssertionRefForUser).toHaveBeenCalledWith({
      redisClientSelector: mockedDependencies.redisClientSelector,
      fiscalCode: mockedDependencies.user.fiscal_code,
    });
    expect(mockGetSessionTtl).toHaveBeenCalledWith(
      mockedDependencies.user.session_token,
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.not.objectContaining({ assertion_ref: expect.any(String) }),
    );
  });

  test("GIVEN Redis throws an error THEN it should return error", async () => {
    // Arrange
    const expectedError = new Error("Redis connection error");
    mockGetLollipopAssertionRefForUser.mockReturnValueOnce(
      TE.right(O.some(anAssertionRef)),
    );
    mockGetSessionTtl.mockReturnValueOnce(() => TE.left(expectedError));

    // Act
    const result = await getUserIdentity(mockedDependencies)();

    // Assert
    expect(result).toEqual(
      E.left(
        expect.objectContaining({
          message: expect.stringContaining(expectedError.message),
        }),
      ),
    );
    expect(mockGetLollipopAssertionRefForUser).toHaveBeenCalledWith({
      redisClientSelector: mockedDependencies.redisClientSelector,
      fiscalCode: mockedDependencies.user.fiscal_code,
    });
    expect(mockGetSessionTtl).toHaveBeenCalledWith(
      mockedDependencies.user.session_token,
    );
  });

  test("GIVEN a session token with zero or negative TTL THEN it should return error", async () => {
    mockGetLollipopAssertionRefForUser.mockReturnValueOnce(
      TE.right(O.some(anAssertionRef)),
    );
    // Arrange
    // The session token is missing
    mockGetSessionTtl.mockReturnValueOnce(() => TE.right(-2));
    // Act
    const result = await getUserIdentity(mockedDependencies)();

    // Assert
    expect(result).toEqual(
      E.left(new Error("Unexpected session token TTL value")),
    );
    expect(mockGetSessionTtl).toHaveBeenCalledWith(
      mockedDependencies.user.session_token,
    );

    // The session token has not expiration
    mockGetSessionTtl.mockReturnValueOnce(() => TE.right(-1));

    const resultNegative = await getUserIdentity(mockedDependencies)();

    expect(resultNegative).toEqual(
      E.left(new Error("Unexpected session token TTL value")),
    );
  });

  test("GIVEN Redis throws an error during assertion retrieval THEN it should return error", async () => {
    // Arrange
    const expectedError = new Error("Redis connection error");
    mockGetLollipopAssertionRefForUser.mockReturnValueOnce(
      TE.left(expectedError),
    );
    mockGetSessionTtl.mockReturnValueOnce(() => TE.right(3600));

    // Act
    const result = await getUserIdentity(mockedDependencies)();

    // Assert
    expect(result).toEqual(E.left(new Error(expectedError.message)));
    expect(mockGetLollipopAssertionRefForUser).toHaveBeenCalledWith({
      redisClientSelector: mockedDependencies.redisClientSelector,
      fiscalCode: mockedDependencies.user.fiscal_code,
    });
    expect(mockGetSessionTtl).toHaveBeenCalledWith(
      mockedDependencies.user.session_token,
    );
  });
});
