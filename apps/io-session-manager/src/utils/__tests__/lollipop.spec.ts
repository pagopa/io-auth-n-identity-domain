/* eslint-disable max-lines-per-function */
import { beforeEach, describe, it, vi, expect } from "vitest";
import * as E from "fp-ts/Either";
import * as TE from "fp-ts/TaskEither";
import { pipe } from "fp-ts/lib/function";
import * as RA from "fp-ts/ReadonlyArray";
import * as O from "fp-ts/Option";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { Request, Response } from "express";
import { TelemetryClient } from "applicationinsights";
import { aFiscalCode, mockedUser } from "../../__mocks__/user.mocks";
import {
  anAssertionRef,
  lollipopRequiredHeaders,
} from "../../__mocks__/lollipop.mocks";
import { AssertionTypeEnum } from "../../generated/lollipop-api/AssertionType";
import { PubKeyStatusEnum } from "../../generated/lollipop-api/PubKeyStatus";
import { LollipopApiClient } from "../../repositories/lollipop-api";
import { extractLollipopLocalsFromLollipopHeaders } from "../lollipop";
import { mockGet, mockRedisClientSelector } from "../../__mocks__/redis.mocks";
import { LollipopRequiredHeaders } from "../../types/lollipop";
import { expressLollipopMiddleware } from "../lollipop";
import {
  aLollipopOriginalMethod,
  aLollipopOriginalUrl,
  anInvalidSignatureInput,
  anotherAssertionRef,
  aSignature,
  aSignatureInput,
} from "../../__mocks__/lollipop.mocks";
import mockReq from "../../__mocks__/request.mocks";
import mockRes from "../../__mocks__/response.mocks";
import { RedisSessionStorageService } from "../../services";

const aBearerToken = "a bearer token";
const aPubKey = "a pub key";

const mockGenerateLCParams = vi.fn().mockImplementation(async () =>
  E.right({
    status: 200,
    value: {
      fiscal_code: aFiscalCode,
      assertion_file_name: `${aFiscalCode}-${anAssertionRef}`,
      assertion_type: AssertionTypeEnum.SAML,
      expired_at: new Date(),
      lc_authentication_bearer: aBearerToken,
      assertion_ref: anAssertionRef,
      pub_key: aPubKey,
      version: 1,
      status: PubKeyStatusEnum.VALID,
      ttl: 900,
    },
  }),
);
const mockLollipopClient: LollipopApiClient = {
  generateLCParams: mockGenerateLCParams,
  activatePubKey: vi.fn(),
  ping: vi.fn(),
  reservePubKey: vi.fn(),
};

const aValidLollipopRequestHeaders = {
  signature: aSignature,
  ["signature-input"]: aSignatureInput,
  ["x-pagopa-lollipop-original-method"]: aLollipopOriginalMethod,
  ["x-pagopa-lollipop-original-url"]: aLollipopOriginalUrl,
};

const mockNext = vi.fn();

const mockGetlollipopAssertionRefForUser = vi
  .spyOn(RedisSessionStorageService, "getLollipopAssertionRefForUser")
  .mockReturnValue(TE.right(O.some(anAssertionRef)));

const mockTelemetryClient = {
  trackEvent: vi.fn(),
} as unknown as TelemetryClient;

describe("extractLollipopLocalsFromLollipopHeaders|>missing fiscal code", () => {
  const mockDependencies = {
    redisClientSelector: mockRedisClientSelector,
    fnLollipopAPIClient: mockLollipopClient,
    appInsightsTelemetryClient: mockTelemetryClient,
  };
  const lcParamsTo404 = (calls: number) =>
    pipe(
      RA.replicate(calls, undefined),
      RA.map(() =>
        mockGenerateLCParams.mockImplementationOnce(async () =>
          E.right({ status: 404 }),
        ),
      ),
    );

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each`
    generateLCParamsCalls
    ${1}
    ${2}
    ${3}
  `(
    "should return the lollipop header when the assertion ref was found for the keyId",
    async ({ generateLCParamsCalls }) => {
      mockGet.mockResolvedValue(anAssertionRef);
      lcParamsTo404(generateLCParamsCalls - 1);
      const res = await extractLollipopLocalsFromLollipopHeaders(
        lollipopRequiredHeaders as LollipopRequiredHeaders,
        undefined,
      )(mockDependencies)();

      expect(mockGenerateLCParams).toHaveBeenCalledTimes(generateLCParamsCalls);
      expect(mockTelemetryClient.trackEvent).toHaveBeenCalledTimes(
        generateLCParamsCalls,
      );
      expect(res).toMatchObject(
        E.right({
          ...lollipopRequiredHeaders,
          "x-pagopa-lollipop-assertion-ref":
            "sha256-6LvipIvFuhyorHpUqK3HjySC5Y6gshXHFBhU9EJ4DoM=",
          "x-pagopa-lollipop-assertion-type": "SAML",
          "x-pagopa-lollipop-auth-jwt": aBearerToken,
          "x-pagopa-lollipop-public-key": aPubKey,
          "x-pagopa-lollipop-user-id": "GRBGPP87L04L741X",
        }),
      );
    },
  );

  it("should return ResponseErrorForbiddenNotAuthorized when no assertion ref was found for the keyId", async () => {
    lcParamsTo404(3);
    const res = await extractLollipopLocalsFromLollipopHeaders(
      lollipopRequiredHeaders as LollipopRequiredHeaders,
      undefined,
    )(mockDependencies)();

    expect(mockGenerateLCParams).toHaveBeenCalledTimes(3);
    expect(mockTelemetryClient.trackEvent).toHaveBeenCalledTimes(3);
    expect(res).toMatchObject(
      E.left({
        detail:
          "You are not allowed here: You do not have enough permission to complete the operation you requested",
        kind: "IResponseErrorForbiddenNotAuthorized",
      }),
    );
  });
});

describe("lollipopMiddleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  it(`
  GIVEN a valid user and valid Lollipop Headers
  WHEN redis returns an assertionRef for the user and lollipop-fn generate LC Params
  THEN additional lollipop headers are included in res.locals
  `, async () => {
    const req = mockReq({
      headers: aValidLollipopRequestHeaders,
      user: mockedUser,
    }) as unknown as Request;
    const res = mockRes() as unknown as Response;
    const middleware = expressLollipopMiddleware(
      mockLollipopClient,
      mockRedisClientSelector,
    );
    await middleware(req, res, mockNext);
    expect(mockGenerateLCParams).toBeCalledTimes(1);
    expect(mockGenerateLCParams).toBeCalledWith({
      assertion_ref: anAssertionRef,
      body: {
        operation_id: expect.any(String),
      },
    });
    expect(res.json).not.toBeCalled();
    expect(res.status).not.toBeCalled();
    expect(res.locals).toEqual({
      ["x-pagopa-lollipop-assertion-ref"]: anAssertionRef,
      ["x-pagopa-lollipop-assertion-type"]: AssertionTypeEnum.SAML,
      ["x-pagopa-lollipop-auth-jwt"]: aBearerToken,
      ["x-pagopa-lollipop-public-key"]: aPubKey,
      ["x-pagopa-lollipop-user-id"]: aFiscalCode,
      ...aValidLollipopRequestHeaders,
    });
    expect(mockNext).toBeCalledTimes(1);
    expect(mockNext).toBeCalledWith();
  });

  it(`
  GIVEN a valid user and Lollipop Headers
  WHEN the headers are invalid
  THEN returns a validation error
  `, async () => {
    const lollipopRequestHeaders = {
      ...aValidLollipopRequestHeaders,
      ["x-pagopa-lollipop-original-url"]: undefined,
    };
    const req = mockReq({
      headers: lollipopRequestHeaders,
      user: mockedUser,
    }) as unknown as Request;
    const res = mockRes() as unknown as Response;
    const middleware = expressLollipopMiddleware(
      mockLollipopClient,
      mockRedisClientSelector,
    );
    await middleware(req, res, mockNext);
    expect(mockGetlollipopAssertionRefForUser).not.toBeCalled();
    expect(mockGenerateLCParams).not.toBeCalled();
    expect(res.status).toBeCalledWith(400);
    expect(mockNext).not.toBeCalled();
  });

  it(`
  GIVEN a valid user and Lollipop Headers
  WHEN the keyid in signature-input is invalid
  THEN returns a an internal server error
  `, async () => {
    const lollipopRequestHeaders = {
      ...aValidLollipopRequestHeaders,
      ["signature-input"]: anInvalidSignatureInput,
    };
    const req = mockReq({
      headers: lollipopRequestHeaders,
      user: mockedUser,
    }) as unknown as Request;
    const res = mockRes() as unknown as Response;
    const middleware = expressLollipopMiddleware(
      mockLollipopClient,
      mockRedisClientSelector,
    );
    await middleware(req, res, mockNext);
    expect(mockGetlollipopAssertionRefForUser).not.toBeCalled();
    expect(mockGenerateLCParams).not.toBeCalled();
    expect(res.status).toBeCalledWith(500);
    expect(mockNext).not.toBeCalled();
  });

  it(`
  GIVEN a user and valid Lollipop Headers
  WHEN the user is invalid
  THEN returns a validation error
  `, async () => {
    const req = mockReq({
      headers: aValidLollipopRequestHeaders,
      user: { ...mockedUser, fiscal_code: "invalidFiscalCode" },
    }) as unknown as Request;
    const res = mockRes() as unknown as Response;
    const middleware = expressLollipopMiddleware(
      mockLollipopClient,
      mockRedisClientSelector,
    );
    await middleware(req, res, mockNext);
    expect(mockGetlollipopAssertionRefForUser).not.toBeCalled();
    expect(mockGenerateLCParams).not.toBeCalled();
    expect(res.status).toBeCalledWith(400);
    expect(mockNext).not.toBeCalled();
  });

  it(`
  GIVEN valid Lollipop Headers without a User
  WHEN the API is not authenticated
  THEN returns success
  `, async () => {
    const req = mockReq({
      headers: aValidLollipopRequestHeaders,
    }) as unknown as Request;
    const res = mockRes() as unknown as Response;
    // Delete the default user value
    // eslint-disable-next-line functional/immutable-data
    req.user = undefined;
    const middleware = expressLollipopMiddleware(
      mockLollipopClient,
      mockRedisClientSelector,
    );
    await middleware(req, res, mockNext);
    expect(mockGenerateLCParams).toBeCalled();
    expect(mockGetlollipopAssertionRefForUser).toBeCalled();
    expect(res.json).not.toBeCalled();
    expect(res.status).not.toBeCalled();
    expect(res.locals).toEqual({
      ["x-pagopa-lollipop-assertion-ref"]: anAssertionRef,
      ["x-pagopa-lollipop-assertion-type"]: AssertionTypeEnum.SAML,
      ["x-pagopa-lollipop-auth-jwt"]: aBearerToken,
      ["x-pagopa-lollipop-public-key"]: aPubKey,
      ["x-pagopa-lollipop-user-id"]: aFiscalCode,
      ...aValidLollipopRequestHeaders,
    });
    expect(mockNext).toBeCalledTimes(1);
    expect(mockNext).toBeCalledWith();
  });

  it.each`
    title                                                                              | lollipopAssertionRefForUser                                | expectedResponseStatus
    ${"the lollipopAssertionRefForUser returns a different assertionRef from request"} | ${() => TE.right(O.some(anotherAssertionRef))}             | ${403}
    ${"the lollipopAssertionRefForUser rejects"}                                       | ${() => TE.left(new Error("promise reject"))}              | ${500}
    ${"the lollipopAssertionRefForUser returns an error"}                              | ${() => TE.left(new Error("Error executing the request"))} | ${500}
    ${"the lollipopAssertionRefForUser not found the value"}                           | ${() => TE.right(O.none)}                                  | ${403}
  `(
    `
  GIVEN a valid user and Lollipop Headers
  WHEN $title
  THEN returns a response error with status $expectedResponseStatus
  `,
    async ({ lollipopAssertionRefForUser, expectedResponseStatus }) => {
      const req = mockReq({
        headers: aValidLollipopRequestHeaders,
        user: mockedUser,
      }) as unknown as Request;
      const res = mockRes() as unknown as Response;
      mockGetlollipopAssertionRefForUser.mockImplementationOnce(
        lollipopAssertionRefForUser,
      );
      const middleware = expressLollipopMiddleware(
        mockLollipopClient,
        mockRedisClientSelector,
      );
      await middleware(req, res, mockNext);
      expect(mockGenerateLCParams).not.toBeCalled();
      expect(res.status).toBeCalledWith(expectedResponseStatus);
      expect(mockNext).not.toBeCalled();
    },
  );

  it.each`
    title                                            | generateLCParams                                     | expectedResponseStatus
    ${"the generateLCParams rejects"}                | ${() => Promise.reject(new Error("promise reject"))} | ${500}
    ${"the generateLCParams returns an error"}       | ${() => Promise.resolve(NonEmptyString.decode(""))}  | ${500}
    ${"the generateLCParams returns bad request"}    | ${() => Promise.resolve(E.right({ status: 400 }))}   | ${500}
    ${"the generateLCParams returns forbidden"}      | ${() => Promise.resolve(E.right({ status: 403 }))}   | ${403}
    ${"the generateLCParams returns not found"}      | ${() => Promise.resolve(E.right({ status: 404 }))}   | ${403}
    ${"the generateLCParams returns error internal"} | ${() => Promise.resolve(E.right({ status: 500 }))}   | ${500}
  `(
    `
  GIVEN a valid user and Lollipop Headers
  WHEN $title
  THEN returns an error with status $expectedResponseStatus
  `,
    async ({ generateLCParams, expectedResponseStatus }) => {
      const req = mockReq({
        headers: aValidLollipopRequestHeaders,
        user: mockedUser,
      }) as unknown as Request;
      const res = mockRes() as unknown as Response;
      mockGenerateLCParams.mockImplementationOnce(generateLCParams);
      const middleware = expressLollipopMiddleware(
        mockLollipopClient,
        mockRedisClientSelector,
        mockTelemetryClient,
      );
      await middleware(req, res, mockNext);
      expect(mockGenerateLCParams).toBeCalledTimes(1);
      expect(mockTelemetryClient.trackEvent).toHaveBeenCalledTimes(1);
      expect(res.status).toBeCalledWith(expectedResponseStatus);
      expect(mockNext).not.toBeCalled();
    },
  );

  it.each`
    title                                            | generateLCParams                                     | expectedResponseStatus
    ${"the generateLCParams rejects"}                | ${() => Promise.reject(new Error("promise reject"))} | ${500}
    ${"the generateLCParams returns an error"}       | ${() => Promise.resolve(NonEmptyString.decode(""))}  | ${500}
    ${"the generateLCParams returns bad request"}    | ${() => Promise.resolve(E.right({ status: 400 }))}   | ${500}
    ${"the generateLCParams returns forbidden"}      | ${() => Promise.resolve(E.right({ status: 403 }))}   | ${403}
    ${"the generateLCParams returns error internal"} | ${() => Promise.resolve(E.right({ status: 500 }))}   | ${500}
  `(
    `
  GIVEN a valid Lollipop Headers
  WHEN $title and user is not defined (fast-login)
  THEN returns an error with status $expectedResponseStatus
  `,
    async ({ generateLCParams, expectedResponseStatus }) => {
      const req = {
        ...mockReq({
          headers: aValidLollipopRequestHeaders,
        }),
        user: undefined,
      } as unknown as Request;
      const res = mockRes() as unknown as Response;
      mockGenerateLCParams.mockImplementationOnce(generateLCParams);
      const middleware = expressLollipopMiddleware(
        mockLollipopClient,
        mockRedisClientSelector,
        mockTelemetryClient,
      );
      await middleware(req, res, mockNext);
      expect(mockGenerateLCParams).toBeCalledTimes(1);
      expect(mockTelemetryClient.trackEvent).toHaveBeenCalledTimes(1);
      expect(res.status).toBeCalledWith(expectedResponseStatus);
      expect(mockNext).not.toBeCalled();
    },
  );

  it(`
  GIVEN a valid Lollipop Headers
  WHEN no assertion ref is found and user is not defined (fast-login)
  THEN returns an error with status code 500
  `, async () => {
    const req = {
      ...mockReq({
        headers: aValidLollipopRequestHeaders,
      }),
      user: undefined,
    } as unknown as Request;
    const res = mockRes() as unknown as Response;

    const nonFoundResponse = () => Promise.resolve(E.right({ status: 404 }));
    mockGenerateLCParams
      .mockImplementationOnce(nonFoundResponse)
      .mockImplementationOnce(nonFoundResponse)
      .mockImplementationOnce(nonFoundResponse);

    const middleware = expressLollipopMiddleware(
      mockLollipopClient,
      mockRedisClientSelector,
      mockTelemetryClient,
    );
    await middleware(req, res, mockNext);
    expect(mockGenerateLCParams).toBeCalledTimes(3);
    expect(mockTelemetryClient.trackEvent).toHaveBeenCalledTimes(3);
    expect(res.status).toBeCalledWith(403);
    expect(mockNext).not.toBeCalled();
  });
});
