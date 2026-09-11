import { describe, test, expect, vi, afterEach } from "vitest";
import * as E from "fp-ts/Either";
import * as O from "fp-ts/Option";
import * as TE from "fp-ts/TaskEither";
import { JwkPublicKey } from "@pagopa/ts-commons/lib/jwk";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { UrlFromString } from "@pagopa/ts-commons/lib/url";
import {
  getClientErrorRedirectionUrl,
  getClientProfileRedirectionUrl,
} from "../../config/spid";
import { mockedFnAppAPIClient } from "../../__mocks__/repositories/fn-app-api-mocks";
import { mockedTableClient } from "../../__mocks__/repositories/table-client-mocks";
import { mockedLollipopApiClient } from "../../__mocks__/repositories/lollipop-api.mocks";
import { mockQueueClient } from "../../__mocks__/repositories/queue-client.mocks";
import { standardTokenDurationSecs } from "../../config/login";
import {
  lvLongSessionDurationSecs,
  lvTokenDurationSecs,
} from "../../config/fast-login";
import { mockAuthSessionsTopicRepository } from "../../repositories/__mocks__/auth-session-topic-repository.mocks";
import { mockServiceBusSender } from "../../__mocks__/service-bus-sender.mocks";
import { mockPlatformInternalAPIService } from "../../__mocks__/platform-internal.mocks";
import { PlatformInternalAPIClient } from "../../repositories/platform-internal-client";
import { OneIdAPIClient } from "../../repositories/one-id-api";

import {
  CallbackDeps,
  exchangeCode,
  getLoginAusiliarData,
  getSAMLAssertion,
  OIDCCallback,
  reserve,
  resolveOidcEnvConfiguration,
} from "../oidc";
import {
  CallbackSuccessInput,
  LoginAusiliarData,
  ReserveInput,
} from "../../types/oidc";
import {
  mockGetDel,
  mockRedisClientSelector,
  mockSetEx,
} from "../../__mocks__/redis.mocks";
import { anAssertionRef } from "../../__mocks__/lollipop.mocks";
import {
  mockGetSamlAssertion,
  mockedOneIdAPIClient,
} from "../../__mocks__/repositories/one-id-api.mocks";
import {
  exchangeAuthorizationCode,
  getOidcConfiguration,
} from "../../repositories/oidc-client";
import * as OneIdConfig from "../../config/one-id";
import { JwkPubKeyHashAlgorithmEnum } from "../../generated/lollipop-api/JwkPubKeyHashAlgorithm";
import type * as client from "openid-client" with { "resolution-mode": "import" };
import {
  mockTrackEvent,
  mockedAppinsightsTelemetryClient,
} from "../../__mocks__/appinsights.mocks";
import { OidcConfigurationEnvEnum } from "../../generated/backend/OidcConfigurationEnv";
import { SpidAuthLevelEnum } from "../../generated/backend/SpidAuthLevel";
import { safeXMLParseFromString } from "@pagopa/io-spid-commons/dist/utils/samlUtils";

vi.mock("../../repositories/oidc-client", () => ({
  getOidcConfiguration: vi.fn(),
  exchangeAuthorizationCode: vi.fn(),
}));

vi.mock("@pagopa/io-spid-commons/dist/utils/samlUtils", () => ({
  safeXMLParseFromString: vi.fn(),
}));

const mockedExchangeAuthorizationCode = vi.mocked(exchangeAuthorizationCode);
const mockedSafeXMLParseFromString = vi.mocked(safeXMLParseFromString);

const mockedGetOidcConfiguration = vi.mocked(getOidcConfiguration);

const aJwk = {
  kty: "EC",
  crv: "P-256",
  x: "4f30zuGMrodEywpJ1zVJmaQ-V-fS89VAMo2fszulNNk",
  y: "lnMva1zx1hRgqV9zuDSwdWGrRXSDIxQt5aRUxmDUn84",
} as unknown as JwkPublicKey;

const aServerMetadata = {
  authorization_endpoint: "https://localhost/authorize",
};
const anOidcConfiguration = {
  serverMetadata: () => aServerMetadata,
} as client.Configuration;

const aState = "a-state" as NonEmptyString;
const aCode = "a-code" as NonEmptyString;
const anAusiliarData: LoginAusiliarData = {
  clientId: "prod-client-id" as NonEmptyString,
  lollipopAssertionRef: anAssertionRef,
  minAuthLevel: SpidAuthLevelEnum.SpidL2,
  nonce: "a-nonce" as NonEmptyString,
  oidcConfigurationEnv: OidcConfigurationEnvEnum.PROD,
};

const anEnvConfig = {
  clientId: "prod-client-id" as NonEmptyString,
  clientSecret: "prod-client-secret" as NonEmptyString,
  issuer: (
    UrlFromString.decode("https://localhost/prod") as E.Right<UrlFromString>
  ).right,
  redirectUri: (
    UrlFromString.decode(
      "https://localhost/api/auth/v2/callback",
    ) as E.Right<UrlFromString>
  ).right,
};

const aCallbackSuccessInput: CallbackSuccessInput = {
  code: aCode,
  state: aState,
};

const aReserveInput: ReserveInput = {
  env: OidcConfigurationEnvEnum.PROD,
  minAuthLevel: SpidAuthLevelEnum.SpidL2,
  jwk: aJwk,
  jwkPubKeyHashAlgorithm: JwkPubKeyHashAlgorithmEnum.sha256,
};

describe("OidcService#reserve", () => {
  const deps = {
    redisClientSelector: mockRedisClientSelector,
    appInsightsTelemetryClient: mockedAppinsightsTelemetryClient,
  };

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("should compute the lollipop assertion ref, save the ausiliar data and return the OIDC parameters", async () => {
    mockedGetOidcConfiguration.mockResolvedValueOnce(
      anOidcConfiguration as client.Configuration,
    );
    mockSetEx.mockResolvedValueOnce("OK");

    const result = await reserve(deps)(aReserveInput);

    expect(mockSetEx).toHaveBeenCalledWith(
      expect.stringContaining("RESERVE-"),
      expect.any(Number),
      expect.stringContaining('"lollipopAssertionRef":"sha256-'),
    );
    expect(result).toMatchObject({
      kind: "IResponseSuccessJson",
      value: {
        client_id: "prod-client-id",
        authorization_endpoint: aServerMetadata.authorization_endpoint,
        redirect_uri: "https://localhost/api/auth/v2/callback",
        state: expect.any(String),
        nonce: expect.any(String),
      },
    });
    expect(mockTrackEvent).not.toHaveBeenCalled();
  });

  test("should return IResponseErrorValidation when the requested environment is not a valid OidcConfigurationEnv", async () => {
    const result = await reserve(deps)({
      ...aReserveInput,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      env: "FOO" as any,
    });

    expect(result.kind).toEqual("IResponseErrorValidation");
    expect(mockSetEx).not.toHaveBeenCalled();
    expect(mockTrackEvent).not.toHaveBeenCalled();
  });

  test("should return IResponseErrorValidation when UAT is requested but only PROD is configured", async () => {
    // Simulates a deployment where only the PROD OneIdentity environment
    // vars are set (UAT is optional), exercising the
    // real `getOidcEnvConfig` "missing configuration" branch (as opposed to
    // the "FOO" case above, which never reaches a valid
    // OidcConfigurationEnv in the first place).
    vi.spyOn(OneIdConfig, "getOneIdEnvConfig").mockReturnValueOnce(
      E.left(new Error('Missing OIDC configuration for environment "UAT"')),
    );

    const result = await reserve(deps)({
      ...aReserveInput,
      env: OidcConfigurationEnvEnum.UAT,
    });

    expect(result.kind).toEqual("IResponseErrorValidation");
    expect(mockedGetOidcConfiguration).not.toHaveBeenCalled();
    expect(mockSetEx).not.toHaveBeenCalled();
    expect(mockTrackEvent).not.toHaveBeenCalled();
  });

  test.each`
    case                       | value
    ${"with an error"}         | ${new Error("discovery failed")}
    ${"with a generic object"} | ${{ foo: "bar" }}
  `(
    "should return IResponseErrorInternal when OIDC discovery fails $case",
    async ({ value }) => {
      mockedGetOidcConfiguration.mockRejectedValueOnce(value);

      const result = await reserve(deps)(aReserveInput);

      expect(result.kind).toEqual("IResponseErrorInternal");
      expect(mockSetEx).not.toHaveBeenCalled();
      expect(mockTrackEvent).toHaveBeenCalledTimes(1);
    },
  );

  test("should return IResponseErrorInternal when OIDC discovery returns an invalid authorization endpoint", async () => {
    mockedGetOidcConfiguration.mockResolvedValueOnce({
      serverMetadata: () => ({
        autorization_endpoint: "foo",
      }),
    } as unknown as client.Configuration);

    const result = await reserve(deps)(aReserveInput);

    expect(result.kind).toEqual("IResponseErrorInternal");
    expect(mockSetEx).not.toHaveBeenCalled();
    expect(mockTrackEvent).toHaveBeenCalledTimes(1);
  });

  test("should return IResponseErrorInternal when saving the ausiliar data fails", async () => {
    mockedGetOidcConfiguration.mockResolvedValueOnce(
      anOidcConfiguration as never,
    );
    mockSetEx.mockRejectedValueOnce(new Error("redis error"));

    const result = await reserve(deps)(aReserveInput);

    expect(result.kind).toEqual("IResponseErrorInternal");
    expect(mockTrackEvent).toHaveBeenCalledTimes(1);
  });
});

describe("OidcService#getLoginAusiliarData", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  const redisDeps = { redisClientSelector: mockRedisClientSelector };

  test("should return the ausiliar data when present", async () => {
    mockGetDel.mockResolvedValueOnce(
      JSON.stringify(LoginAusiliarData.encode(anAusiliarData)),
    );

    const result = await getLoginAusiliarData(redisDeps)(aState);

    expect(result).toEqual(E.right(anAusiliarData));
  });

  test("should return an error when the ausiliar data is missing or expired", async () => {
    mockGetDel.mockResolvedValueOnce(null);

    const result = await getLoginAusiliarData(redisDeps)(aState);

    expect(E.isLeft(result)).toBeTruthy();
    if (E.isLeft(result)) {
      expect(result.left.message).toEqual(
        "Missing or expired OIDC login ausiliar data",
      );
    }
  });

  test("should return an error when redis rejects", async () => {
    const anError = new Error("redis error");
    mockGetDel.mockRejectedValueOnce(anError);

    const result = await getLoginAusiliarData(redisDeps)(aState);

    expect(result).toEqual(E.left(anError));
  });
});

describe("OidcService#resolveOidcEnvConfiguration", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  test("should return the resolved env config and oidc configuration", async () => {
    mockedGetOidcConfiguration.mockResolvedValueOnce(anOidcConfiguration);

    const result = await resolveOidcEnvConfiguration(
      OidcConfigurationEnvEnum.PROD,
    );

    expect(result).toEqual(
      E.right({
        envConfig: expect.objectContaining({
          clientId: "prod-client-id",
        }),
        oidcConfiguration: anOidcConfiguration,
      }),
    );
  });

  test("should return an error when the requested environment is not configured", async () => {
    vi.spyOn(OneIdConfig, "getOneIdEnvConfig").mockReturnValueOnce(
      E.left(new Error('Missing OIDC configuration for environment "UAT"')),
    );

    const result = await resolveOidcEnvConfiguration(
      OidcConfigurationEnvEnum.UAT,
    );

    expect(E.isLeft(result)).toBeTruthy();
    expect(mockedGetOidcConfiguration).not.toHaveBeenCalled();
  });

  test.each`
    case                       | value
    ${"with an error"}         | ${new Error("discovery failed")}
    ${"with a generic object"} | ${{ foo: "bar" }}
  `(
    "should return an error when OIDC discovery fails $case",
    async ({ value }) => {
      mockedGetOidcConfiguration.mockRejectedValueOnce(value);

      const result = await resolveOidcEnvConfiguration(
        OidcConfigurationEnvEnum.PROD,
      );

      expect(E.isLeft(result)).toBeTruthy();
    },
  );
});

describe("OidcService#exchangeCode", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  test("should return the decoded token response on a successful code exchange", async () => {
    const aTokenResponse = {
      access_token: "an-access-token",
      id_token: "an-id-token",
    } as client.TokenEndpointResponse & client.TokenEndpointResponseHelpers;

    mockedExchangeAuthorizationCode.mockResolvedValueOnce(aTokenResponse);

    const result = await exchangeCode(
      anOidcConfiguration,
      anEnvConfig,
      anAusiliarData,
      aCallbackSuccessInput,
    );

    expect(mockedExchangeAuthorizationCode).toHaveBeenCalledExactlyOnceWith(
      anOidcConfiguration,
      expect.any(URL),
      {
        expectedNonce: anAusiliarData.nonce,
        expectedState: aCallbackSuccessInput.state,
        idTokenExpected: true,
      },
    );
    expect(result).toEqual(E.right(aTokenResponse));
  });

  test("should return an error when the token response cannot be decoded", async () => {
    mockedExchangeAuthorizationCode.mockResolvedValueOnce({} as any);

    const result = await exchangeCode(
      anOidcConfiguration,
      anEnvConfig,
      anAusiliarData,
      aCallbackSuccessInput,
    );

    expect(E.isLeft(result)).toBeTruthy();
    if (E.isLeft(result)) {
      expect(result.left.message).toContain(
        "Could not decode OIDC exchange code API response",
      );
    }
  });

  test("should return an error when the code exchange rejects", async () => {
    const anError = new Error("code exchange failed");
    mockedExchangeAuthorizationCode.mockRejectedValueOnce(anError);

    const result = await exchangeCode(
      anOidcConfiguration,
      anEnvConfig,
      anAusiliarData,
      aCallbackSuccessInput,
    );

    expect(result).toEqual(E.left(anError));
  });
});

describe("OidcService#getSAMLAssertion", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  const anAccessToken = "an-access-token" as NonEmptyString;
  const anIssuer = anEnvConfig.issuer;
  const aFakeDocument = {} as Document;

  test("should return the parsed assertion document", async () => {
    mockGetSamlAssertion.mockReturnValueOnce(TE.right("<xml/>"));
    mockedSafeXMLParseFromString.mockReturnValueOnce(O.some(aFakeDocument));

    const result = await getSAMLAssertion(
      anAccessToken,
      { oneIdAPIClient: mockedOneIdAPIClient },
      anIssuer,
    );

    expect(mockGetSamlAssertion).toHaveBeenCalledExactlyOnceWith(
      anIssuer.href,
      anAccessToken,
    );
    expect(result).toEqual(E.right(aFakeDocument));
  });

  test("should return an error when the SAML assertion retrieval fails", async () => {
    const anError = new Error("could not retrieve assertion");
    mockGetSamlAssertion.mockReturnValueOnce(TE.left(anError));

    const result = await getSAMLAssertion(
      anAccessToken,
      { oneIdAPIClient: mockedOneIdAPIClient },
      anIssuer,
    );

    expect(result).toEqual(E.left(anError));
  });

  test("should return an error when the assertion parsing returns none", async () => {
    mockGetSamlAssertion.mockReturnValueOnce(TE.right("not-xml"));
    mockedSafeXMLParseFromString.mockReturnValueOnce(O.none);

    const result = await getSAMLAssertion(
      anAccessToken,
      { oneIdAPIClient: mockedOneIdAPIClient },
      anIssuer,
    );

    expect(E.isLeft(result)).toBeTruthy();
    if (E.isLeft(result)) {
      expect(result.left.message).toEqual(
        "Empty assertion returned from parsing",
      );
    }
  });
});

describe("OidcService#OIDCCallback", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  const callbackDeps: CallbackDeps = {
    redisClientSelector: mockRedisClientSelector,
    fnAppAPIClient: mockedFnAppAPIClient,
    lockUserTableClient: mockedTableClient,
    fnLollipopAPIClient: mockedLollipopApiClient,
    lollipopRevokeQueueClient: mockQueueClient,
    notificationQueueClient: mockQueueClient,
    getClientErrorRedirectionUrl,
    getClientProfileRedirectionUrl,
    allowedCieTestFiscalCodes: [],
    standardTokenDurationSecs,
    lvTokenDurationSecs,
    lvLongSessionDurationSecs,
    isTestUser: () => false,
    isUserElegibleForIoLoginUrlScheme: () => false,
    appInsightsTelemetryClient: mockedAppinsightsTelemetryClient,
    isUserElegibleForFastLogin: () => false,
    isUserElegibleForValidationCookie: () => false,
    AuthSessionsTopicRepository: mockAuthSessionsTopicRepository,
    authSessionsTopicSender: mockServiceBusSender,
    platformInternalAPIClient: {} as PlatformInternalAPIClient,
    platformInternalAPIService: mockPlatformInternalAPIService,
    oneIdAPIClient: mockedOneIdAPIClient,
  };

  test("should return IResponseErrorValidation when the login state is missing or expired", async () => {
    mockGetDel.mockResolvedValueOnce(null);

    const result = await OIDCCallback(callbackDeps)(aCallbackSuccessInput);

    expect(result.kind).toEqual("IResponseErrorValidation");
    expect(mockTrackEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "session-manager.oidc.callback.ausiliar-data.error",
      }),
    );
  });

  test("should return IResponseErrorInternal when OIDC discovery fails", async () => {
    mockGetDel.mockResolvedValueOnce(
      JSON.stringify(LoginAusiliarData.encode(anAusiliarData)),
    );
    mockedGetOidcConfiguration.mockRejectedValueOnce(
      new Error("discovery failed"),
    );

    const result = await OIDCCallback(callbackDeps)(aCallbackSuccessInput);

    expect(result.kind).toEqual("IResponseErrorInternal");
    expect(mockTrackEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "session-manager.oidc.callback.discovery.error",
      }),
    );
  });

  test("should return IResponseErrorInternal when the code exchange fails", async () => {
    mockGetDel.mockResolvedValueOnce(
      JSON.stringify(LoginAusiliarData.encode(anAusiliarData)),
    );
    mockedGetOidcConfiguration.mockResolvedValueOnce(anOidcConfiguration);
    mockedExchangeAuthorizationCode.mockRejectedValueOnce(
      new Error("code exchange failed"),
    );

    const result = await OIDCCallback(callbackDeps)(aCallbackSuccessInput);

    expect(result.kind).toEqual("IResponseErrorInternal");
    expect(mockTrackEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "session-manager.oidc.callback.code-exchange.error",
      }),
    );
  });

  test("should return IResponseErrorInternal when the SAML assertion retrieval fails", async () => {
    mockGetDel.mockResolvedValueOnce(
      JSON.stringify(LoginAusiliarData.encode(anAusiliarData)),
    );
    mockedGetOidcConfiguration.mockResolvedValueOnce(
      anOidcConfiguration as never,
    );
    mockedExchangeAuthorizationCode.mockResolvedValueOnce({
      access_token: "an-access-token",
      id_token: "an-id-token",
    } as never);
    mockGetSamlAssertion.mockReturnValueOnce(
      TE.left(new Error("saml assertion error")),
    );

    const result = await OIDCCallback(callbackDeps)(aCallbackSuccessInput);

    expect(result.kind).toEqual("IResponseErrorInternal");
    expect(mockTrackEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "session-manager.oidc.callback.saml-assertion.error",
      }),
    );
  });

  test("should return IResponsePermanentRedirect on a successful callback", async () => {
    mockGetDel.mockResolvedValueOnce(
      JSON.stringify(LoginAusiliarData.encode(anAusiliarData)),
    );
    mockedGetOidcConfiguration.mockResolvedValueOnce(
      anOidcConfiguration as never,
    );
    mockedExchangeAuthorizationCode.mockResolvedValueOnce({
      access_token: "an-access-token",
      id_token: "an-id-token",
    } as never);
    mockGetSamlAssertion.mockReturnValueOnce(TE.right("<xml/>"));
    mockedSafeXMLParseFromString.mockReturnValueOnce(O.some({} as Document));

    const result = await OIDCCallback(callbackDeps)(aCallbackSuccessInput);

    expect(result.kind).toEqual("IResponsePermanentRedirect");
    expect(mockTrackEvent).not.toHaveBeenCalled();
  });
});
