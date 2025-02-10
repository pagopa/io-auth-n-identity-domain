/* eslint-disable max-lines-per-function */
import crypto from "crypto";
import { afterAll, describe, test, expect, vi, beforeEach } from "vitest";
import { Request, Response } from "express";
import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";
import * as E from "fp-ts/Either";
import * as O from "fp-ts/Option";
import { ResponseSuccessJson } from "@pagopa/ts-commons/lib/responses";
import { addSeconds } from "date-fns";
import mockRes from "../../__mocks__/response.mocks";
import {
  mockedInitializedProfile,
  mockedUser,
} from "../../__mocks__/user.mocks";
import { mockGet, mockRedisClientSelector } from "../../__mocks__/redis.mocks";
import { anAssertionRef } from "../../__mocks__/lollipop.mocks";
import mockReq from "../../__mocks__/request.mocks";
import * as profileService from "../../services/profile";
import { FnAppAPIClient } from "../../repositories/fn-app-api";
import { getSessionState, logout } from "../session";
import { RedisClientSelectorType } from "../../types/redis";
import { LollipopApiClient } from "../../repositories/lollipop-api";
import {
  mockRevokeAssertionRefAssociation,
  mockedLollipopService,
} from "../../__mocks__/services/lollipopService.mocks";
import {
  mockDeleteUser,
  mockGetLollipopAssertionRefForUser,
  mockedRedisSessionStorageService,
} from "../../__mocks__/services/redisSessionStorageService.mocks";
import { toExpectedResponse } from "../../__tests__/utils";
import { RedisSessionStorageService, TokenService } from "../../services";

vi.setSystemTime(new Date(2025, 0, 1));

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

  const ttl = 1800;
  vi.spyOn(
    RedisSessionStorageService,
    "getSessionRemainingTtlFast",
  ).mockReturnValue(TE.right(ttl));

  const expectedExpirationDate = addSeconds(new Date(), ttl).toISOString();

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
      expirationDate: expectedExpirationDate,
    });
  });

  test("GIVEN a valid request WHEN lollipop is NOT initialized for the user THEN it should return a correct session state", async () => {
    mockGet.mockResolvedValueOnce(null);

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
      expirationDate: expectedExpirationDate,
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

  test("GIVEN a valid request WHEN an error occurs retrieving the user profile THEN it should return a correct session state", async () => {
    const expectedError = new Error("Network Error");
    mockGetProfile.mockReturnValueOnce(TE.left(expectedError));
    mockGet.mockResolvedValueOnce(null);

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
      expirationDate: expectedExpirationDate,
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
});

describe("logout", () => {
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
  });

  test(`
  GIVEN an enabled lollipop flow
  WHEN the session can not be destroyed
  THEN it should fail after sending the pub key revokal message and deleting the assertionRef`, async () => {
    mockDeleteUser.mockImplementationOnce(() => (_deps) => TE.right(false));

    const result = await logout(mockedDependencies)();

    expect(result).toEqual(E.left(Error("Error destroying the user session")));

    expect(mockRevokeAssertionRefAssociation).toHaveBeenCalled();
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
  });
});
