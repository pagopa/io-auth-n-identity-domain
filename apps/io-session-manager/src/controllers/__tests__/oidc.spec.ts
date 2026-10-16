import { describe, test, expect, vi, afterEach } from "vitest";
import { Request } from "express";
import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";
import { IPString, NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { ResponseErrorInternal } from "@pagopa/ts-commons/lib/responses";

import mockReq from "../../__mocks__/request.mocks";
import {
  mockGet,
  mockDel,
  mockRedisClientSelector,
  mockSetEx,
} from "../../__mocks__/redis.mocks";
import { getOidcConfiguration } from "../../repositories/oidc-client";
import {
  mockOIDCCallback,
  mockOIDCCallbackInner,
} from "../../__mocks__/services/oidc.mocks";
import {
  getClientErrorRedirectionUrl,
  getClientProfileRedirectionUrl,
} from "../../config/spid";
import { callbackEndpoint, reserveEndpoint } from "../oidc";
import { mockedFnAppAPIClient } from "../../__mocks__/repositories/fn-app-api-mocks";
import { mockedTableClient } from "../../__mocks__/repositories/table-client-mocks";
import { mockedLollipopApiClient } from "../../__mocks__/repositories/lollipop-api.mocks";
import { mockQueueClient } from "../../__mocks__/repositories/queue-client.mocks";
import { LOGIN_AGE_LIMIT, standardTokenDurationSecs } from "../../config/login";
import {
  lvLongSessionDurationSecs,
  lvTokenDurationSecs,
} from "../../config/fast-login";
import {
  mockedAppinsightsTelemetryClient,
  mockTrackEvent,
} from "../../__mocks__/appinsights.mocks";
import { mockAuthSessionsTopicRepository } from "../../repositories/__mocks__/auth-session-topic-repository.mocks";
import { mockServiceBusSender } from "../../__mocks__/service-bus-sender.mocks";
import { mockPlatformInternalAPIService } from "../../__mocks__/platform-internal.mocks";
import { PlatformInternalAPIClient } from "../../repositories/platform-internal-client";
import { CallbackDeps } from "../../services/oidc";
import { OneIdAPIClient } from "../../repositories/one-id-api";
import { sha256 } from "@pagopa/io-functions-commons/dist/src/utils/crypto";
import { WithIP } from "../../utils/network";

vi.mock("../../repositories/oidc-client", () => ({
  getOidcConfiguration: vi.fn(),
}));

vi.mock("../../services/oidc", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../services/oidc")>()),
  OIDCCallback: mockOIDCCallback,
}));

const mockedGetOidcConfiguration = vi.mocked(getOidcConfiguration);

const AN_ENCODED_JWK =
  "eyJrdHkiOiJFQyIsImNydiI6IlAtMjU2IiwieCI6IjRmMzB6dUdNcm9kRXl3cEoxelZKbWFRLVYtZlM4OVZBTW8yZnN6dWxOTmsiLCJ5IjoibG5NdmExengxaFJncVY5enVEU3dkV0dyUlhTREl4UXQ1YVJVeG1EVW44NCJ9";

const aServerMetadata = {
  authorization_endpoint: "https://localhost/authorize",
};
const anOidcConfiguration = {
  serverMetadata: () => aServerMetadata,
};

describe("OidcController#reserveEndpoint", () => {
  const deps = {
    redisClientSelector: mockRedisClientSelector,
    clientIP: "10.0.0.1" as IPString,
  };

  const buildReq = (body: Record<string, unknown>) =>
    mockReq({ body }) as unknown as Request;

  afterEach(() => {
    vi.clearAllMocks();
  });

  test.each(["SpidL2", "SpidL3"])(
    "should decode %s and return the reserve response",
    async (minAuthLevel) => {
      mockedGetOidcConfiguration.mockResolvedValueOnce(
        anOidcConfiguration as never,
      );
      mockSetEx.mockResolvedValueOnce("OK");

      const req = buildReq({
        env: "PROD",
        min_auth_level: minAuthLevel,
        lollipop_pub_key: AN_ENCODED_JWK,
        lollipop_hash_algo: "sha256",
      });

      const result = await pipe(
        { ...deps, req },
        reserveEndpoint,
        TE.toUnion,
      )();

      expect(result).toMatchObject({
        kind: "IResponseSuccessJson",
        value: {
          acr_values: `https://www.spid.gov.it/${minAuthLevel}`,
          client_id: "prod-client-id",
          authorization_endpoint: aServerMetadata.authorization_endpoint,
          redirect_uri: "https://localhost/api/auth/v1/callback",
          state: expect.any(String),
          nonce: expect.any(String),
        },
      });
    },
  );

  test.each([
    "SpidL1",
    "https://www.spid.gov.it/SpidL2",
    "https://www.spid.gov.it/SpidL3",
  ])("should reject min_auth_level %s", async (minAuthLevel) => {
    const req = buildReq({
      env: "PROD",
      min_auth_level: minAuthLevel,
      lollipop_pub_key: AN_ENCODED_JWK,
      lollipop_hash_algo: "sha256",
    });

    const result = await pipe({ ...deps, req }, reserveEndpoint, TE.toUnion)();

    expect(result).toMatchObject({ kind: "IResponseErrorValidation" });
    expect(mockedGetOidcConfiguration).not.toHaveBeenCalled();
    expect(mockSetEx).not.toHaveBeenCalled();
  });

  test("should return IResponseErrorValidation when required params are missing", async () => {
    const req = buildReq({});

    const result = await pipe({ ...deps, req }, reserveEndpoint, TE.toUnion)();

    expect(result).toMatchObject({ kind: "IResponseErrorValidation" });
    expect(mockedGetOidcConfiguration).not.toHaveBeenCalled();
  });
});

describe("OidcController#callbackEndpoint", () => {
  const deps: CallbackDeps & WithIP = {
    clientIP: "10.0.0.1" as IPString,
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
    oneIdAPIClient: {} as OneIdAPIClient,
    ageLimit: LOGIN_AGE_LIMIT,
    validateSpidUser: vi.fn(),
    getIdentityProvider: vi.fn(),
  };

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("should decode a successful callback and delegate to OIDCCallback", async () => {
    const expectedResponse = ResponseErrorInternal("unused");
    mockOIDCCallbackInner.mockResolvedValueOnce(expectedResponse);

    const req = mockReq({
      query: {
        code: "a-code",
        state: "a-state",
      },
    }) as unknown as Request;

    const result = await pipe({ ...deps, req }, callbackEndpoint, TE.toUnion)();

    expect(mockOIDCCallbackInner).toHaveBeenCalledWith({
      code: "a-code",
      state: "a-state",
    });
    expect(result).toEqual(expectedResponse);
    expect(mockTrackEvent).not.toHaveBeenCalled();
  });

  test("should forward an authorization error as a permanent redirect and invalidate the auxiliary data", async () => {
    mockGet.mockResolvedValueOnce(JSON.stringify({}));
    mockDel.mockResolvedValueOnce(1);

    const expectedErrorDetail = getClientErrorRedirectionUrl({
      errorCode: 22,
      errorMessage: "access_denied" as NonEmptyString,
    }).href;
    const req = mockReq({
      query: {
        error: "access_denied",
        error_description: "22",
        state: "a-state",
      },
    }) as unknown as Request;

    const result = await pipe({ ...deps, req }, callbackEndpoint, TE.toUnion)();

    expect(mockGet).toHaveBeenCalledWith(expect.stringContaining("a-state"));
    expect(mockOIDCCallback).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      kind: "IResponsePermanentRedirect",
      detail: expectedErrorDetail,
    });
    expect(mockTrackEvent).toHaveBeenCalledExactlyOnceWith(
      {
        name: "session-manager.oidc.callback.upstream-error.warning",
        properties: {
          redirectTarget: "client_error",
          state: "a-state",
          ipHash: sha256(deps.clientIP),
          oiError: "access_denied",
          oiErrorDescription: "22",
        },
        tagOverrides: { samplingEnabled: "false" },
      },
    );
  });

  test("should forward an error and event when auxiliary-data remediation fails", async () => {
    const anError = Error("private-diagnostic a-state 10.0.0.1");
    mockGet.mockRejectedValueOnce(anError);

    const expectedErrorDetail = getClientErrorRedirectionUrl({
      errorCode: 22,
      errorMessage: "access_denied" as NonEmptyString,
    }).href;
    const req = mockReq({
      query: {
        error: "access_denied",
        error_description: "22",
        state: "a-state",
      },
    }) as unknown as Request;

    const result = await pipe({ ...deps, req }, callbackEndpoint, TE.toUnion)();

    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockOIDCCallback).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      kind: "IResponsePermanentRedirect",
      detail: expectedErrorDetail,
    });
    expect(mockTrackEvent).toHaveBeenCalledTimes(2);
    expect(mockTrackEvent).toHaveBeenNthCalledWith(
      1,
      {
        name: "session-manager.oidc.callback.upstream-error.warning",
        properties: {
          redirectTarget: "client_error",
          state: "a-state",
          ipHash: sha256(deps.clientIP),
          oiError: "access_denied",
          oiErrorDescription: "22",
        },
        tagOverrides: { samplingEnabled: "false" },
      },
    );
    expect(mockTrackEvent).toHaveBeenNthCalledWith(
      2,
      {
        name: "session-manager.oidc.callback.auxiliary-remediation.warning",
        properties: {
          state: "a-state",
          ipHash: sha256(deps.clientIP),
          failureReason: "auxiliary_data_cleanup_failed",
        },
        tagOverrides: { samplingEnabled: "false" },
      },
    );
    expect(JSON.stringify(mockTrackEvent.mock.calls)).not.toContain(
      "private-diagnostic",
    );
    expect(JSON.stringify(mockTrackEvent.mock.calls)).not.toContain(
      deps.clientIP,
    );
  });

  test("should forward an error as a permanent redirect with errorCode and errorMessage", async () => {
    mockGet.mockResolvedValueOnce(JSON.stringify({}));
    mockDel.mockResolvedValueOnce(1);

    const expectedErrorDetail = getClientErrorRedirectionUrl({
      errorCode: 22,
      errorMessage: "access_denied" as NonEmptyString,
    }).href;
    const req = mockReq({
      query: {
        error: "access_denied",
        error_description: "22",
        state: "a-state",
      },
    }) as unknown as Request;

    const result = await pipe({ ...deps, req }, callbackEndpoint, TE.toUnion)();

    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockOIDCCallback).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      kind: "IResponsePermanentRedirect",
      detail: expectedErrorDetail,
    });
    expect(mockTrackEvent).toHaveBeenCalledExactlyOnceWith(
      {
        name: "session-manager.oidc.callback.upstream-error.warning",
        properties: {
          redirectTarget: "client_error",
          state: "a-state",
          ipHash: sha256(deps.clientIP),
          oiError: "access_denied",
          oiErrorDescription: "22",
        },
        tagOverrides: { samplingEnabled: "false" },
      },
    );
  });

  test("should forward an error as a permanent redirect with only errorMessage", async () => {
    mockGet.mockResolvedValueOnce(JSON.stringify({}));
    mockDel.mockResolvedValueOnce(1);

    const expectedErrorDetail = getClientErrorRedirectionUrl({
      errorMessage: "internal_error" as NonEmptyString,
    }).href;
    const req = mockReq({
      query: {
        error: "internal_error",
        state: "a-state",
      },
    }) as unknown as Request;

    const result = await pipe({ ...deps, req }, callbackEndpoint, TE.toUnion)();

    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockOIDCCallback).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      kind: "IResponsePermanentRedirect",
      detail: expectedErrorDetail,
    });
    expect(mockTrackEvent).toHaveBeenCalledExactlyOnceWith(
      {
        name: "session-manager.oidc.callback.upstream-error.warning",
        properties: {
          redirectTarget: "client_error",
          state: "a-state",
          ipHash: sha256(deps.clientIP),
          oiError: "unknown",
        },
        tagOverrides: { samplingEnabled: "false" },
      },
    );
  });

  test.each([
    {},
    {
      state: "a-state",
      error: "access_denied",
      error_description: "",
    },
  ])("should return a generic error redirect for invalid callback input %j", async (query) => {
    const expectedErrorDetail = getClientErrorRedirectionUrl({
      errorMessage: "error occurred" as NonEmptyString,
    }).href;
    const req = mockReq({ query }) as unknown as Request;

    const result = await pipe({ ...deps, req }, callbackEndpoint, TE.toUnion)();

    expect(mockGet).not.toHaveBeenCalled();
    expect(mockOIDCCallback).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      kind: "IResponsePermanentRedirect",
      detail: expectedErrorDetail,
    });
    expect(mockTrackEvent).toHaveBeenCalledExactlyOnceWith(
      {
        name: "session-manager.oidc.callback.upstream-error.warning",
        properties: {
          redirectTarget: "client_error",
          ipHash: sha256(deps.clientIP),
          failureReason: "invalid_callback_input",
        },
        tagOverrides: { samplingEnabled: "false" },
      },
    );
    expect(mockTrackEvent.mock.calls[0][0].properties).not.toHaveProperty(
      "state",
    );
    expect(mockTrackEvent.mock.calls[0][0].properties).not.toHaveProperty(
      "nonce",
    );
  });

  test.each([
    "22private-diagnostic a-state 10.0.0.1",
    "https://example.test/?state=a-state&nonce=private-diagnostic",
    "-22",
    "22\n",
    "12345678901",
    undefined,
  ])(
    "should omit unsafe upstream descriptions (%s) without changing the redirect",
    async (description) => {
      mockGet.mockResolvedValueOnce(null);
      const error = "private-diagnostic a-state 10.0.0.1";
      const req = mockReq({
        query: { state: "a-state", error, error_description: description },
      }) as unknown as Request;

      const result = await pipe(
        { ...deps, req },
        callbackEndpoint,
        TE.toUnion,
      )();

      expect(result).toMatchObject({
        kind: "IResponsePermanentRedirect",
        detail: getClientErrorRedirectionUrl({
          errorMessage: error as NonEmptyString,
          ...(parseInt(description || "", 10)
            ? { errorCode: parseInt(description || "", 10) }
            : {}),
        }).href,
      });
      expect(mockTrackEvent).toHaveBeenCalledExactlyOnceWith({
        name: "session-manager.oidc.callback.upstream-error.warning",
        properties: {
          state: "a-state",
          ipHash: sha256(deps.clientIP),
          redirectTarget: "client_error",
          oiError: "unknown",
        },
        tagOverrides: { samplingEnabled: "false" },
      });
      expect(JSON.stringify(mockTrackEvent.mock.calls)).not.toContain(
        "private-diagnostic",
      );
      expect(JSON.stringify(mockTrackEvent.mock.calls)).not.toContain(
        deps.clientIP,
      );
    },
  );
});
