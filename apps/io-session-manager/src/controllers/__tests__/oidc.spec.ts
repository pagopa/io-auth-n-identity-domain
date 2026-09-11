import { describe, test, expect, vi, afterEach } from "vitest";
import { Request } from "express";
import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { ResponseErrorInternal } from "@pagopa/ts-commons/lib/responses";

import mockReq from "../../__mocks__/request.mocks";
import {
  mockGetDel,
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
import { standardTokenDurationSecs } from "../../config/login";
import {
  lvLongSessionDurationSecs,
  lvTokenDurationSecs,
} from "../../config/fast-login";
import { mockedAppinsightsTelemetryClient } from "../../__mocks__/appinsights.mocks";
import { mockAuthSessionsTopicRepository } from "../../repositories/__mocks__/auth-session-topic-repository.mocks";
import { mockServiceBusSender } from "../../__mocks__/service-bus-sender.mocks";
import { mockPlatformInternalAPIService } from "../../__mocks__/platform-internal.mocks";
import { PlatformInternalAPIClient } from "../../repositories/platform-internal-client";
import { CallbackDeps } from "../../services/oidc";
import { OneIdAPIClient } from "../../repositories/one-id-api";

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
  };

  const buildReq = (body: Record<string, unknown>) =>
    mockReq({ body }) as unknown as Request;

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("should decode the request and return the reserve response", async () => {
    mockedGetOidcConfiguration.mockResolvedValueOnce(
      anOidcConfiguration as never,
    );
    mockSetEx.mockResolvedValueOnce("OK");

    const req = buildReq({
      env: "PROD",
      min_auth_level: "SpidL2",
      lollipop_pub_key: AN_ENCODED_JWK,
      lollipop_hash_algo: "sha256",
    });

    const result = await pipe({ ...deps, req }, reserveEndpoint, TE.toUnion)();
    expect(result).toMatchObject({ kind: "IResponseSuccessJson" });
  });

  test("should return IResponseErrorValidation when required params are missing", async () => {
    const req = buildReq({});

    const result = await pipe({ ...deps, req }, reserveEndpoint, TE.toUnion)();

    expect(result).toMatchObject({ kind: "IResponseErrorValidation" });
    expect(mockedGetOidcConfiguration).not.toHaveBeenCalled();
  });
});

describe("OidcController#callbackEndpoint", () => {
  const deps: CallbackDeps = {
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
  });

  test("should forward an authorization error as a permanent redirect and invalidate the ausiliar data", async () => {
    mockGetDel.mockResolvedValueOnce(JSON.stringify({}));

    const req = mockReq({
      query: {
        error: "access_denied",
        error_description: "22",
        state: "a-state",
      },
    }) as unknown as Request;

    const result = await pipe({ ...deps, req }, callbackEndpoint, TE.toUnion)();

    expect(mockGetDel).toHaveBeenCalledWith(expect.stringContaining("a-state"));
    expect(mockOIDCCallback).not.toHaveBeenCalled();
    expect(result).toMatchObject({ kind: "IResponsePermanentRedirect" });
    expect((result as { detail: string }).detail).toEqual(
      getClientErrorRedirectionUrl({
        errorCode: 22,
        errorMessage: "access_denied" as NonEmptyString,
      }).href,
    );
  });

  test("should return a generic error redirect when neither a success nor an error input can be decoded", async () => {
    const req = mockReq({}) as unknown as Request;

    const result = await pipe({ ...deps, req }, callbackEndpoint, TE.toUnion)();

    expect(mockGetDel).not.toHaveBeenCalled();
    expect(mockOIDCCallback).not.toHaveBeenCalled();
    expect(result).toMatchObject({ kind: "IResponsePermanentRedirect" });
    expect(result).toMatchObject({
      detail: getClientErrorRedirectionUrl({
        errorMessage: "error occurred" as NonEmptyString,
      }).href,
    });
  });
});
