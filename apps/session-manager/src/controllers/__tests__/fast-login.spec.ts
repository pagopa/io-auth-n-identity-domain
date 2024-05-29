import { describe, beforeEach, vi, it, expect } from "vitest";
import * as E from "fp-ts/Either";
import * as RNEA from "fp-ts/ReadonlyNonEmptyArray";
import * as TE from "fp-ts/TaskEither";
import {
  ResponseErrorUnauthorized,
  ResponseSuccessJson,
} from "@pagopa/ts-commons/lib/responses";
import {
  FiscalCode,
  IPString,
  NonEmptyString,
} from "@pagopa/ts-commons/lib/strings";
import { readableReportSimplified } from "@pagopa/ts-commons/lib/reporters";
import { Errors } from "io-ts";
import { pipe } from "fp-ts/lib/function";
import { fastLoginEndpoint, generateNonceEndpoint } from "../fast-login";
import { FnFastLoginAPIClient } from "../../repositories/fast-login-api";
import { readableProblem } from "../../utils/errors";
import {
  BPDToken,
  FIMSToken,
  MyPortalToken,
  SessionToken,
  WalletToken,
  ZendeskToken,
} from "../../types/token";
import { SpidLevelEnum } from "../../types/spid-level";
import { getASAMLResponse } from "../../__mocks__/spid.mocks";
import { FastLoginResponse as LCFastLoginResponse } from "../../generated/fast-login-api/FastLoginResponse";
import { LollipopJWTAuthorization } from "../../generated/fast-login-api/LollipopJWTAuthorization";
import { LollipopPublicKey } from "../../generated/fast-login-api/LollipopPublicKey";
import { LollipopMethodEnum } from "../../generated/fast-login-api/LollipopMethod";
import { LollipopLocalsType } from "../../types/lollipop";
import { AssertionTypeEnum } from "../../generated/fast-login-api/AssertionType";
import {
  aLollipopOriginalUrl,
  aSignature,
  aSignatureInput,
  anAssertionRef,
} from "../../__mocks__/lollipop.mocks";
import { aFiscalCode } from "../../__mocks__/user.mocks";
import { mockRedisClientSelector } from "../../__mocks__/redis.mocks";
import { RedisSessionStorageService } from "../../services";
import { BadRequest } from "../../generated/fast-login-api/BadRequest";
import * as spidUtils from "../../utils/spid";
import { UserWithoutTokens } from "../../types/user";
import { FastLoginConfig } from "../../config";
import { toExpectedResponse } from "../../__tests__/utils";

const aRandomToken = "RANDOMTOKEN";
const validFastLoginControllerResponse = {
  token: aRandomToken as SessionToken,
};
const validFastLoginLCResponse = {
  saml_response: getASAMLResponse(
    "GDASDV00A01H501J" as FiscalCode,
    "_2d2a89e99c7583e221b4" as NonEmptyString,
  ),
} as LCFastLoginResponse;
const aValidGenerateNonceResponse = {
  nonce: "870c6d89-a3c4-48b1-a796-cdacddaf94b4",
};
const mockGenerateNonce = vi
  .fn()
  .mockResolvedValue(
    E.right({ status: 200, value: aValidGenerateNonceResponse }),
  );
const mockLCFastLogin = vi
  .fn()
  .mockResolvedValue(E.right({ status: 200, value: validFastLoginLCResponse }));

const fastLoginLCClient = {
  generateNonce: mockGenerateNonce,
  fastLogin: mockLCFastLogin,
} as unknown as ReturnType<FnFastLoginAPIClient>;

const mockGetNewToken = vi.fn().mockResolvedValue(aRandomToken);
vi.mock("../../services/token", () => ({
  getNewTokenAsync: () => Promise.resolve(mockGetNewToken()),
}));

const mockIsBlockedUser = vi.spyOn(RedisSessionStorageService, "isBlockedUser");

const mockSetSession = vi.spyOn(RedisSessionStorageService, "set");

const sessionTTL = 60 * 15;
const aClientIP = "10.0.0.2" as IPString;

const constructInternalError = (message: string) =>
  E.left(Error(`Internal server error: ${message}`));

const aBearerToken = "token" as LollipopJWTAuthorization;
const aPublicKey = "publickey" as LollipopPublicKey;

const lollipopRequestHeaders = {
  signature: aSignature,
  ["signature-input"]: aSignatureInput,
  ["x-pagopa-lollipop-original-method"]: LollipopMethodEnum.POST,
  ["x-pagopa-lollipop-original-url"]: aLollipopOriginalUrl,
};

const fastLoginLollipopLocals: LollipopLocalsType = {
  ...lollipopRequestHeaders,
  ["x-pagopa-lollipop-assertion-ref"]: anAssertionRef,
  ["x-pagopa-lollipop-assertion-type"]: AssertionTypeEnum.SAML,
  ["x-pagopa-lollipop-auth-jwt"]: aBearerToken,
  ["x-pagopa-lollipop-public-key"]: aPublicKey,
  ["x-pagopa-lollipop-user-id"]: aFiscalCode,
};

const fastLoginBaseDeps = {
  fnFastLoginAPIClient: fastLoginLCClient,
  lvTokenDurationSecs: sessionTTL,
  redisClientSelector: mockRedisClientSelector,
  clientIP: aClientIP,
  locals: fastLoginLollipopLocals,
  sessionTTL: FastLoginConfig.lvTokenDurationSecs,
};

// eslint-disable-next-line max-lines-per-function
describe("fastLoginController#fastLogin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create a valid session of 15 minutes given a valid payload", async () => {
    const validUserSetPayload = {
      session_token: aRandomToken as SessionToken,
      bpd_token: aRandomToken as BPDToken,
      fims_token: aRandomToken as FIMSToken,
      wallet_token: aRandomToken as WalletToken,
      zendesk_token: aRandomToken as ZendeskToken,
      myportal_token: aRandomToken as MyPortalToken,
      created_at: expect.any(Number),
      date_of_birth: "1970-01-01",
      family_name: "AgID",
      fiscal_code: expect.any(String),
      name: "SpidValidator",
      session_tracking_id: aRandomToken,
      spid_email: "spid.tech@agid.gov.it",
      spid_idp: "http://localhost:8080",
      spid_level: SpidLevelEnum["https://www.spid.gov.it/SpidL2"],
    };
    const mockSetUser = vi.fn().mockReturnValue(TE.right(true));
    mockIsBlockedUser.mockReturnValueOnce(TE.right(false));
    mockSetSession.mockReturnValue(mockSetUser);

    const response = await fastLoginEndpoint(fastLoginBaseDeps)();

    expect(mockLCFastLogin).toHaveBeenCalledTimes(1);
    expect(mockLCFastLogin).toHaveBeenCalledWith({
      ...fastLoginLollipopLocals,
      ["x-pagopa-lv-client-ip"]: aClientIP,
    });

    expect(mockIsBlockedUser).toHaveBeenCalledTimes(1);
    expect(mockIsBlockedUser).toHaveBeenCalledWith({
      fiscalCode: aFiscalCode,
      redisClientSelector: mockRedisClientSelector,
    });

    expect(mockSetSession).toHaveBeenCalledTimes(1);
    expect(mockSetSession).toHaveBeenCalledWith(
      mockRedisClientSelector,
      sessionTTL,
    );
    expect(mockSetUser).toHaveBeenCalledTimes(1);
    expect(mockSetUser).toHaveBeenCalledWith(validUserSetPayload);

    expect(mockGetNewToken).toHaveBeenCalledTimes(7);

    expect(response).toEqual(
      E.right(
        toExpectedResponse(
          ResponseSuccessJson(validFastLoginControllerResponse),
        ),
      ),
    );
  });

  it("should fail when lollipop locals are invalid", async () => {
    const response = await fastLoginEndpoint({
      ...fastLoginBaseDeps,
      locals: {
        ...fastLoginLollipopLocals,
        "x-pagopa-lollipop-user-id": "NOTAFISCALCODE",
      },
    })();

    expect(response).toEqual(
      constructInternalError("Could not initialize Lollipop"),
    );
  });

  it("should fail when the lollipop consumer can't be contacted", async () => {
    mockLCFastLogin.mockRejectedValueOnce(null);
    const response = await fastLoginEndpoint(fastLoginBaseDeps)();

    expect(mockLCFastLogin).toHaveBeenCalledTimes(1);
    expect(response).toEqual(
      constructInternalError("Error while calling the Lollipop Consumer"),
    );
  });

  it("should fail when the lollipop consumer gives a decoding error", async () => {
    const badRequest = BadRequest.decode({}) as E.Left<Errors>;
    mockLCFastLogin.mockResolvedValueOnce(BadRequest.decode({}));
    const response = await fastLoginEndpoint(fastLoginBaseDeps)();

    expect(mockLCFastLogin).toHaveBeenCalledTimes(1);
    expect(response).toEqual(
      constructInternalError(
        `Unexpected Lollipop consumer response: ${readableReportSimplified(badRequest.left)}`,
      ),
    );
  });

  it("should return 401 when the lollipop consumer gives a 401 Unauthorized", async () => {
    mockLCFastLogin.mockResolvedValueOnce(E.right({ status: 401 }));
    const response = await fastLoginEndpoint(fastLoginBaseDeps)();

    expect(mockLCFastLogin).toHaveBeenCalledTimes(1);
    expect(response).toEqual(
      E.right(
        toExpectedResponse(
          ResponseErrorUnauthorized("Invalid signature or nonce expired"),
        ),
      ),
    );
  });

  it.each`
    title                   | status
    ${"500"}                | ${500}
    ${"other status codes"} | ${599}
  `(
    "should return 500 when the lollipop consumer gives $title",
    async ({ status }) => {
      mockLCFastLogin.mockResolvedValueOnce(
        E.right({ status, value: { detail: "error", title: "error" } }),
      );
      const response = await fastLoginEndpoint(fastLoginBaseDeps)();

      expect(mockLCFastLogin).toHaveBeenCalledTimes(1);
      expect(response).toEqual(
        constructInternalError(
          `Error in Lollipop consumer. Response contains ${status} with title error and detail error`,
        ),
      );
    },
  );

  it("should return 500 when the lollipop consumer gives an invalid saml_response", async () => {
    mockLCFastLogin.mockResolvedValueOnce(
      E.right({ status: 200, value: { saml_response: "" } }),
    );
    const response = await fastLoginEndpoint(fastLoginBaseDeps)();

    expect(mockLCFastLogin).toHaveBeenCalledTimes(1);
    expect(response).toEqual(
      constructInternalError(
        "Could not parse saml response from Lollipop consumer",
      ),
    );
  });

  it("should return 403 when the user is blocked", async () => {
    mockIsBlockedUser.mockReturnValueOnce(TE.right(true));
    const response = await fastLoginEndpoint(fastLoginBaseDeps)();

    expect(mockLCFastLogin).toHaveBeenCalledTimes(1);
    expect(mockIsBlockedUser).toHaveBeenCalledTimes(1);
    expect(response).toEqual(
      E.right(toExpectedResponse(ResponseErrorUnauthorized("User is blocked"))),
    );
  });

  it("should return 500 when the session storage could not determine if the user is blocked", async () => {
    mockIsBlockedUser.mockReturnValueOnce(TE.left(new Error("error")));
    const response = await fastLoginEndpoint(fastLoginBaseDeps)();

    expect(mockLCFastLogin).toHaveBeenCalledTimes(1);
    expect(mockIsBlockedUser).toHaveBeenCalledTimes(1);
    expect(response).toEqual(
      constructInternalError("Error while validating user"),
    );
  });

  it("should return 500 when the controller can't extract the data from the saml_response", async () => {
    const makeProxyUser = vi.spyOn(spidUtils, "makeProxyUserFromSAMLResponse");

    mockIsBlockedUser.mockReturnValueOnce(TE.right(false));
    makeProxyUser.mockReturnValueOnce(UserWithoutTokens.decode({}));

    const response = await fastLoginEndpoint(fastLoginBaseDeps)();

    expect(mockLCFastLogin).toHaveBeenCalledTimes(1);
    expect(mockIsBlockedUser).toHaveBeenCalledTimes(1);
    expect(makeProxyUser).toHaveBeenCalledTimes(1);
    expect(response).toEqual(
      constructInternalError("Could not create proxy user"),
    );
  });

  it("should return 500 when the session storage could not create the session for the user", async () => {
    const mockSetUser = vi
      .fn()
      .mockReturnValueOnce(TE.left(new Error("error")));
    mockIsBlockedUser.mockReturnValueOnce(TE.right(false));
    mockSetSession.mockReturnValueOnce(mockSetUser);

    const response = await fastLoginEndpoint(fastLoginBaseDeps)();

    expect(mockLCFastLogin).toHaveBeenCalledTimes(1);
    expect(mockIsBlockedUser).toHaveBeenCalledTimes(1);
    expect(mockSetSession).toHaveBeenCalledTimes(1);
    expect(mockSetUser).toHaveBeenCalledTimes(1);
    expect(response).toEqual(
      constructInternalError(
        "Could not create user using session storage: error",
      ),
    );
  });

  it("should return 500 when the session token created is of the wrong type", async () => {
    const decodeErrors = (NonEmptyString.decode("") as E.Left<Errors>).left;
    const expectedErrorMessage = `Could not decode session token|${readableReportSimplified(decodeErrors)}`;
    const mockSetUser = vi.fn().mockReturnValueOnce(TE.right(true));
    mockIsBlockedUser.mockReturnValueOnce(TE.right(false));
    mockSetSession.mockReturnValueOnce(mockSetUser);
    pipe(
      RNEA.range(0, 6),
      RNEA.map(() => mockGetNewToken.mockResolvedValueOnce("")),
    );

    const response = await fastLoginEndpoint(fastLoginBaseDeps)();

    expect(mockLCFastLogin).toHaveBeenCalledTimes(1);
    expect(mockIsBlockedUser).toHaveBeenCalledTimes(1);
    expect(mockSetSession).toHaveBeenCalledTimes(1);
    expect(mockSetUser).toHaveBeenCalledTimes(1);
    expect(mockGetNewToken).toHaveBeenCalledTimes(7);
    expect(response).toEqual(constructInternalError(expectedErrorMessage));
  });
});

describe("fastLoginController#generateNonce", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const generateNonceController = generateNonceEndpoint({
    fnFastLoginAPIClient: fastLoginLCClient,
  });

  it("should return the nonce, when the the downstream component returns it", async () => {
    const result = await generateNonceController();
    const expectedResult = ResponseSuccessJson(aValidGenerateNonceResponse);

    expect(mockGenerateNonce).toHaveBeenCalled();
    expect(result).toEqual(E.right(toExpectedResponse(expectedResult)));
  });

  it.each`
    title                                                             | clientResponse                                            | expectedResult
    ${"should return InternalServerError when the client return 401"} | ${E.right({ status: 401 })}                               | ${Error("Underlying API fails with an unexpected 401")}
    ${"should return InternalServerError when the client return 500"} | ${E.right({ status: 500, value: { title: "an Error" } })} | ${Error(readableProblem({ detail: "an Error" }))}
    ${"should return InternalServerError when the client return 502"} | ${E.right({ status: 502 })}                               | ${Error("An error occurred on upstream service")}
    ${"should return InternalServerError when the client return 504"} | ${E.right({ status: 504 })}                               | ${Error("An error occurred on upstream service")}
  `("$title", async ({ clientResponse, expectedResult }) => {
    mockGenerateNonce.mockResolvedValue(clientResponse);

    const result = await generateNonceController();

    expect(mockGenerateNonce).toHaveBeenCalled();
    expect(result).toEqual(E.left(Error(expectedResult.message)));
  });
});
