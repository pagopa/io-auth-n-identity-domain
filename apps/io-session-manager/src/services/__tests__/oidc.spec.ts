import { describe, test, expect, vi, afterEach } from "vitest";
import * as E from "fp-ts/Either";
import * as O from "fp-ts/Option";
import * as TE from "fp-ts/TaskEither";
import { JwkPublicKey } from "@pagopa/ts-commons/lib/jwk";
import { FiscalCode, NonEmptyString } from "@pagopa/ts-commons/lib/strings";
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

import {
  CallbackDeps,
  exchangeCode,
  getLoginAusiliarData,
  getSAMLAssertion,
  OIDCCallback,
  reserve,
  resolveOidcEnvConfiguration,
  performSAMLAssertionChecks,
} from "../oidc";
import {
  CallbackSuccessInput,
  LoginAusiliarData,
  ReserveInput,
} from "../../types/oidc";
import {
  mockGet,
  mockDel,
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
import * as jwt from "jsonwebtoken";
import { getASAMLResponse } from "../../__mocks__/spid.mocks";
import { aFiscalCode } from "../../__mocks__/user.mocks";
import { SpidLevelEnum } from "../../types/spid-level";
import { OidcUserClaims } from "../../types/oidc";
import type * as express from "express";
import { ResponsePermanentRedirect } from "@pagopa/ts-commons/lib/responses";
import * as AuthenticationController from "../../controllers/authentication";
import { DateFromString } from "@pagopa/ts-commons/lib/dates";

vi.mock("../../repositories/oidc-client", () => ({
  getOidcConfiguration: vi.fn(),
  exchangeAuthorizationCode: vi.fn(),
}));

vi.mock(
  "@pagopa/io-spid-commons/dist/utils/samlUtils",
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import("@pagopa/io-spid-commons/dist/utils/samlUtils")
      >();
    return {
      ...actual,
      // spies on the actual implementation by default, so real SAML fixtures
      // are parsed into real Documents, while still allowing tests to
      // override the return value when needed
      safeXMLParseFromString: vi.fn(actual.safeXMLParseFromString),
    };
  },
);

vi.mock("../../controllers/authentication", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("../../controllers/authentication")
  >()),
  acs: vi.fn(),
}));

const mockedExchangeAuthorizationCode = vi.mocked(exchangeAuthorizationCode);
const mockedSafeXMLParseFromString = vi.mocked(safeXMLParseFromString);
const mockedAcs = vi.mocked(AuthenticationController.acs);

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

const anIdTokenPayload = {
  fiscalNumber: `TINIT-${aFiscalCode}`,
  name: "a-name",
  familyName: "a-family-name",
  dateOfBirth: "1970-01-01",
  acr: SpidLevelEnum["https://www.spid.gov.it/SpidL2"],
  iss: "https://oneid.example.it",
};
// NOTE: the id token signature has already been verified upstream by
// `exchangeAuthorizationCode` (see NOTE in `exchangeCode`), so a dummy
// signing secret is enough to build a realistic fixture for `jwt.decode`
const anIdToken = jwt.sign(anIdTokenPayload, "a-test-secret") as NonEmptyString;
const anIdTokenClaims = (
  OidcUserClaims.decode(anIdTokenPayload) as E.Right<OidcUserClaims>
).right;

const aSAMLAssertionXML = getASAMLResponse(
  aFiscalCode,
  anAssertionRef as unknown as NonEmptyString,
  SpidLevelEnum["https://www.spid.gov.it/SpidL2"],
);

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
        redirect_uri: "https://localhost/api/auth/v1/callback",
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
    mockGet.mockResolvedValueOnce(
      JSON.stringify(LoginAusiliarData.encode(anAusiliarData)),
    );
    mockDel.mockResolvedValueOnce(1);

    const result = await getLoginAusiliarData(redisDeps)(aState);

    expect(result).toEqual(E.right(anAusiliarData));
    expect(mockDel).toHaveBeenCalledWith(`RESERVE-${aState}`);
  });

  test("should return an error when the ausiliar data is missing or expired", async () => {
    mockGet.mockResolvedValueOnce(null);

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
    mockGet.mockRejectedValueOnce(anError);

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
      id_token: anIdToken,
      claims: () => anIdTokenClaims,
    } as unknown as client.TokenEndpointResponse &
      client.TokenEndpointResponseHelpers;

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
    expect(result).toEqual(
      E.right({
        accessToken: "an-access-token",
        claims: anIdTokenClaims,
      }),
    );
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

  test("should return an error when the id token claims cannot be decoded", async () => {
    const anInvalidIdToken = jwt.sign(
      { ...anIdTokenPayload, fiscalNumber: undefined },
      "a-test-secret",
    ) as NonEmptyString;
    mockedExchangeAuthorizationCode.mockResolvedValueOnce({
      access_token: "an-access-token",
      id_token: anInvalidIdToken,
      claims: () => anInvalidIdToken,
    } as any);

    const result = await exchangeCode(
      anOidcConfiguration,
      anEnvConfig,
      anAusiliarData,
      aCallbackSuccessInput,
    );

    expect(E.isLeft(result)).toBeTruthy();
    if (E.isLeft(result)) {
      expect(result.left.message).toContain(
        "Could not decode OIDC id_token claims",
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
    expect(result).toEqual(
      E.right({ assertionXml: "<xml/>", assertion: aFakeDocument }),
    );
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

describe("OidcService#performSAMLAssertionChecks", () => {
  const parseAssertion = (xml: string): Document =>
    O.toUndefined(safeXMLParseFromString(xml)) as Document;

  test("should return right when all checks pass", async () => {
    const samlAssertion = parseAssertion(aSAMLAssertionXML);

    const result = await performSAMLAssertionChecks(
      samlAssertion,
      anIdTokenClaims,
      anAusiliarData,
    )();

    expect(result).toEqual(E.right(true));
  });

  test("should return an error when the SAML assertion has been tampered with (trailing content)", async () => {
    const tamperedXML = `${aSAMLAssertionXML}<injected>evil</injected>`;
    const samlAssertion = parseAssertion(tamperedXML);

    const result = await performSAMLAssertionChecks(
      samlAssertion,
      anIdTokenClaims,
      anAusiliarData,
    )();

    expect(E.isLeft(result)).toBeTruthy();
    if (E.isLeft(result)) {
      expect(result.left.message).toEqual(
        "SAML assertion has an invalid or tampered format",
      );
    }
  });

  test("should return an error when the fiscal number doesn't match the id token claims", async () => {
    const samlAssertion = parseAssertion(
      getASAMLResponse(
        "AAABBB00A00A000A" as FiscalCode,
        anAssertionRef as unknown as NonEmptyString,
        SpidLevelEnum["https://www.spid.gov.it/SpidL2"],
      ),
    );

    const result = await performSAMLAssertionChecks(
      samlAssertion,
      anIdTokenClaims,
      anAusiliarData,
    )();

    expect(E.isLeft(result)).toBeTruthy();
    if (E.isLeft(result)) {
      expect(result.left.message).toEqual(
        "Fiscal number mismatch between id token and SAML assertion",
      );
    }
  });

  test("should return an error when InResponseTo doesn't match the lollipop assertion ref", async () => {
    const samlAssertion = parseAssertion(
      getASAMLResponse(
        aFiscalCode,
        "a-different-assertion-ref" as NonEmptyString,
        SpidLevelEnum["https://www.spid.gov.it/SpidL2"],
      ),
    );

    const result = await performSAMLAssertionChecks(
      samlAssertion,
      anIdTokenClaims,
      anAusiliarData,
    )();

    expect(E.isLeft(result)).toBeTruthy();
    if (E.isLeft(result)) {
      expect(result.left.message).toEqual(
        "SAML assertion InResponseTo does not match the expected assertion ref",
      );
    }
  });

  test("should return an error when the SPID level is lower than the required minAuthLevel", async () => {
    const samlAssertion = parseAssertion(aSAMLAssertionXML);
    const lowerAcrIdTokenClaims = {
      ...anIdTokenClaims,
      acr: SpidLevelEnum["https://www.spid.gov.it/SpidL1"],
    };

    const result = await performSAMLAssertionChecks(
      samlAssertion,
      lowerAcrIdTokenClaims,
      anAusiliarData,
    )();

    expect(E.isLeft(result)).toBeTruthy();
    if (E.isLeft(result)) {
      expect(result.left.message).toEqual(
        "SPID authentication level lower than the requested minAuthLevel",
      );
    }
  });
});

describe("OidcService#OIDCCallback", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });
  const AGE_LIMIT = 18;

  const callbackDeps: CallbackDeps & { req: express.Request } = {
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
    ageLimit: AGE_LIMIT,
    AuthSessionsTopicRepository: mockAuthSessionsTopicRepository,
    authSessionsTopicSender: mockServiceBusSender,
    platformInternalAPIClient: {} as PlatformInternalAPIClient,
    platformInternalAPIService: mockPlatformInternalAPIService,
    oneIdAPIClient: mockedOneIdAPIClient,
    req: {} as express.Request,
  };

  test("should return IResponseErrorValidation when the login state is missing or expired", async () => {
    mockGet.mockResolvedValueOnce(null);

    const result = await OIDCCallback(callbackDeps)(aCallbackSuccessInput);

    expect(result.kind).toEqual("IResponseErrorValidation");
    expect(mockTrackEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "session-manager.oidc.callback.ausiliar-data.error",
      }),
    );
  });

  test("should return IResponseErrorInternal when OIDC discovery fails", async () => {
    mockGet.mockResolvedValueOnce(
      JSON.stringify(LoginAusiliarData.encode(anAusiliarData)),
    );
    mockDel.mockResolvedValueOnce(1);
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
    mockGet.mockResolvedValueOnce(
      JSON.stringify(LoginAusiliarData.encode(anAusiliarData)),
    );
    mockDel.mockResolvedValueOnce(1);
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
    mockGet.mockResolvedValueOnce(
      JSON.stringify(LoginAusiliarData.encode(anAusiliarData)),
    );
    mockDel.mockResolvedValueOnce(1);
    mockedGetOidcConfiguration.mockResolvedValueOnce(
      anOidcConfiguration as never,
    );
    mockedExchangeAuthorizationCode.mockResolvedValueOnce({
      access_token: "an-access-token",
      id_token: anIdToken,
      claims: () => anIdTokenClaims,
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

  test("should return IResponseErrorValidation when the SAML assertion verification fails", async () => {
    mockGet.mockResolvedValueOnce(
      JSON.stringify(LoginAusiliarData.encode(anAusiliarData)),
    );
    mockDel.mockResolvedValueOnce(1);
    mockedGetOidcConfiguration.mockResolvedValueOnce(
      anOidcConfiguration as never,
    );
    mockedExchangeAuthorizationCode.mockResolvedValueOnce({
      access_token: "an-access-token",
      id_token: anIdToken,
      claims: () => anIdTokenClaims,
    } as never);
    // fiscal number in the SAML assertion doesn't match the one in the id token
    mockGetSamlAssertion.mockReturnValueOnce(
      TE.right(
        getASAMLResponse(
          "AAABBB00A00A000A" as FiscalCode,
          anAssertionRef as unknown as NonEmptyString,
          SpidLevelEnum["https://www.spid.gov.it/SpidL2"],
        ),
      ),
    );

    const result = await OIDCCallback(callbackDeps)(aCallbackSuccessInput);

    expect(result.kind).toEqual("IResponseErrorValidation");
    expect(mockTrackEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "session-manager.oidc.callback.saml-verification.error",
      }),
    );
  });

  test("should call acs and return its response on a successful callback", async () => {
    mockGet.mockResolvedValueOnce(
      JSON.stringify(LoginAusiliarData.encode(anAusiliarData)),
    );
    mockDel.mockResolvedValueOnce(1);
    mockedGetOidcConfiguration.mockResolvedValueOnce(
      anOidcConfiguration as never,
    );
    mockedExchangeAuthorizationCode.mockResolvedValueOnce({
      access_token: "an-access-token",
      id_token: anIdToken,
      claims: () => anIdTokenClaims,
    } as never);
    mockGetSamlAssertion.mockReturnValueOnce(TE.right(aSAMLAssertionXML));

    const anAcsResponse = ResponsePermanentRedirect({
      href: "https://localhost/success",
    });
    const mockAcsHandler = vi.fn().mockResolvedValueOnce(anAcsResponse);
    mockedAcs.mockReturnValueOnce(mockAcsHandler);

    const result = await OIDCCallback(callbackDeps)(aCallbackSuccessInput);

    expect(mockedAcs).toHaveBeenCalledExactlyOnceWith({
      ...callbackDeps,
      isUserElegibleForValidationCookie: expect.any(Function),
      validateSpidUser: expect.any(Function),
    });
    const injectedValidateSpidUser =
      mockedAcs.mock.calls[0][0].validateSpidUser;
    const validatedUser = injectedValidateSpidUser({});
    expect(E.isRight(validatedUser)).toBeTruthy();
    if (E.isRight(validatedUser)) {
      expect(validatedUser.right).toEqual(
        expect.objectContaining({
          authnContextClassRef: anIdTokenClaims.acr,
          fiscalNumber: anIdTokenClaims.fiscalNumber,
          name: anIdTokenClaims.name,
          familyName: anIdTokenClaims.familyName,
          dateOfBirth: DateFromString.encode(anIdTokenClaims.dateOfBirth),
          email: anIdTokenClaims.email,
          issuer: anIdTokenClaims.iss,
          getAcsOriginalRequest: expect.any(Function),
          getAssertionXml: expect.any(Function),
          getSamlResponseXml: expect.any(Function),
        }),
      );
    }
    expect(mockAcsHandler).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        authnContextClassRef: anIdTokenClaims.acr,
        fiscalNumber: anIdTokenClaims.fiscalNumber,
        name: anIdTokenClaims.name,
        familyName: anIdTokenClaims.familyName,
        dateOfBirth: DateFromString.encode(anIdTokenClaims.dateOfBirth),
        email: anIdTokenClaims.email,
        issuer: anIdTokenClaims.iss,
        getAcsOriginalRequest: expect.any(Function),
        getAssertionXml: expect.any(Function),
        getSamlResponseXml: expect.any(Function),
      }),
      {
        loginType: anAusiliarData.loginType,
        currentUser: anAusiliarData.currentUser,
      },
    );
    expect(result).toEqual(anAcsResponse);
    expect(mockTrackEvent).not.toHaveBeenCalled();
  });
});
