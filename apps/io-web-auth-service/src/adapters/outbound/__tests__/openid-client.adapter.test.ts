import { type NonEmptyString, ValidationError } from "@pagopa/hexagonal-core";
import { err, ok } from "neverthrow";
import * as client from "openid-client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { aFiscalCode, aValidClaims } from "../../../__mocks__/session.mocks.js";
import {
  InvalidAuthorizationEndpointError,
  OidcCodeExchangeError,
  OidcDiscoveryError,
} from "../../../domain/errors/oidc.errors.js";
import {
  type OidcConfig,
  type OidcConfigPort,
} from "../../../domain/ports/outbound/oidc-config.port.js";
import { type OidcExchangeParams } from "../../../domain/ports/outbound/oidc.port.js";
import { OpenIdClientAdapter } from "../openid-client.adapter.js";

vi.mock("openid-client", () => ({
  discovery: vi.fn(),
  authorizationCodeGrant: vi.fn(),
  ClientSecretBasic: vi.fn(() => "client-secret-basic"),
  customFetch: Symbol("customFetch"),
}));

const anIssuer = aValidClaims.iss;
const anAuthorizationEndpoint = `${anIssuer}/oidc/authorize`;

const anEnvConfig: OidcConfig = {
  clientId: "a-client-id" as NonEmptyString,
  clientSecret: "a-client-secret" as NonEmptyString,
  baseUrl: new URL(anIssuer),
  redirectUri: new URL("https://api-web.io.pagopa.it/ioweb/auth/v2/callback"),
};

const anExchangeParams: OidcExchangeParams = {
  env: "PROD",
  code: "an-auth-code" as NonEmptyString,
  state: "a-state" as NonEmptyString,
  expectedNonce: "a-nonce" as NonEmptyString,
};

const makeConfiguration = (
  authorizationEndpoint?: string,
): client.Configuration =>
  ({
    serverMetadata: () => ({
      authorization_endpoint: authorizationEndpoint,
    }),
  }) as client.Configuration;

const aConfiguration = makeConfiguration(anAuthorizationEndpoint);

const oidcConfigPort: OidcConfigPort = {
  getConfig: vi.fn(),
};
const makeTokens = (claims: unknown) => ({ claims: () => claims }) as never;

let adapter: OpenIdClientAdapter;

beforeEach(() => {
  vi.clearAllMocks();
  adapter = new OpenIdClientAdapter(oidcConfigPort, 5);
  vi.mocked(oidcConfigPort.getConfig).mockReturnValue(ok(anEnvConfig));
  vi.mocked(client.discovery).mockResolvedValue(aConfiguration);
  vi.mocked(client.authorizationCodeGrant).mockResolvedValue(
    makeTokens(aValidClaims),
  );
});

describe("OpenIdClientAdapter#exchange", () => {
  it("returns the validated ID token claims on success", async () => {
    const result = await adapter.exchange(anExchangeParams);

    expect(result).toEqual(ok(aValidClaims));
  });

  it("discards email and dateOfBirth even when their values are invalid", async () => {
    vi.mocked(client.authorizationCodeGrant).mockResolvedValue(
      makeTokens({
        ...aValidClaims,
        email: "not-an-email",
        dateOfBirth: "not-a-date",
      }),
    );

    const result = await adapter.exchange(anExchangeParams);

    expect(result).toEqual(ok(aValidClaims));
  });

  it("strips a TINIT- prefix from fiscalNumber", async () => {
    vi.mocked(client.authorizationCodeGrant).mockResolvedValue(
      makeTokens({ ...aValidClaims, fiscalNumber: `TINIT-${aFiscalCode}` }),
    );

    const result = await adapter.exchange(anExchangeParams);

    expect(result).toEqual(ok(aValidClaims));
  });

  it("sends the registered redirect URI and validates state and nonce", async () => {
    await adapter.exchange(anExchangeParams);

    expect(client.authorizationCodeGrant).toHaveBeenCalledExactlyOnceWith(
      aConfiguration,
      new URL(
        `${anEnvConfig.redirectUri.href}?code=${anExchangeParams.code}&state=${anExchangeParams.state}`,
      ),
      {
        expectedState: anExchangeParams.state,
        expectedNonce: anExchangeParams.expectedNonce,
        idTokenExpected: true,
      },
    );
  });

  it("keeps the query params of the registered redirect URI", async () => {
    vi.mocked(oidcConfigPort.getConfig).mockReturnValue(
      ok({
        ...anEnvConfig,
        redirectUri: new URL("https://app.example.com/callback?flow=web"),
      }),
    );

    await adapter.exchange(anExchangeParams);

    expect(client.authorizationCodeGrant).toHaveBeenCalledWith(
      aConfiguration,
      new URL(
        "https://app.example.com/callback?flow=web&code=an-auth-code&state=a-state",
      ),
      expect.anything(),
    );
  });

  it("returns a discovery_failed error when the environment is not configured", async () => {
    vi.mocked(oidcConfigPort.getConfig).mockReturnValue(
      err(new ValidationError("missing config")),
    );

    const result = await adapter.exchange(anExchangeParams);

    const error = result._unsafeUnwrapErr();
    expect(error).toBeInstanceOf(OidcDiscoveryError);
    expect(error.message).toContain(
      "Missing OIDC configuration: Validation error: missing config",
    );
    expect(client.authorizationCodeGrant).not.toHaveBeenCalled();
  });

  it("returns a discovery_failed error when discovery fails", async () => {
    vi.mocked(client.discovery).mockRejectedValue(new Error("discovery down"));

    const result = await adapter.exchange(anExchangeParams);

    const error = result._unsafeUnwrapErr();
    expect(error).toBeInstanceOf(OidcDiscoveryError);
    expect(error.message).toContain("OIDC discovery failed: discovery down");
    expect(client.authorizationCodeGrant).not.toHaveBeenCalled();
  });

  it.each([
    { case: "missing", claims: undefined },
    {
      case: "invalid",
      claims: { ...aValidClaims, fiscalNumber: "not-a-fiscal-code" },
    },
    {
      case: "missing a required claim",
      claims: { ...aValidClaims, idpEntityId: undefined },
    },
  ])(
    "returns a code_exchange_failed error when the ID token claims are $case",
    async ({ claims }) => {
      vi.mocked(client.authorizationCodeGrant).mockResolvedValue(
        makeTokens(claims),
      );

      const result = await adapter.exchange(anExchangeParams);

      const error = result._unsafeUnwrapErr();
      expect(error).toBeInstanceOf(OidcCodeExchangeError);
      expect(error.message).toContain(
        "OIDC code exchange failed: invalid ID token claims",
      );
    },
  );

  it("returns a code_exchange_failed error when the authorization code grant throws", async () => {
    vi.mocked(client.authorizationCodeGrant).mockRejectedValue(
      new Error("nonce mismatch"),
    );

    const result = await adapter.exchange(anExchangeParams);

    const error = result._unsafeUnwrapErr();
    expect(error).toBeInstanceOf(OidcCodeExchangeError);
    expect(error.message).toContain(
      "OIDC code exchange failed: nonce mismatch",
    );
  });
});

describe("OpenIdClientAdapter#getAuthorizationEndpoint", () => {
  it("returns ok(authorization_endpoint) from discovered metadata", async () => {
    const result = await adapter.getAuthorizationEndpoint("PROD");

    expect(result).toEqual(ok(new URL(anAuthorizationEndpoint)));
    expect(client.discovery).toHaveBeenCalledExactlyOnceWith(
      anEnvConfig.baseUrl,
      anEnvConfig.clientId,
      { client_secret: anEnvConfig.clientSecret },
      "client-secret-basic",
      { timeout: 5, [client.customFetch]: expect.any(Function) },
    );
  });

  it("shares cached discovery for the same environment", async () => {
    await adapter.getAuthorizationEndpoint("PROD");
    await adapter.getAuthorizationEndpoint("PROD");

    expect(client.discovery).toHaveBeenCalledTimes(1);
  });

  it("retries discovery on the next call after a failed discovery", async () => {
    vi.mocked(client.discovery).mockRejectedValueOnce(
      new Error("discovery down"),
    );

    const firstResult = await adapter.getAuthorizationEndpoint("PROD");
    const secondResult = await adapter.getAuthorizationEndpoint("PROD");

    expect(firstResult._unsafeUnwrapErr()).toBeInstanceOf(OidcDiscoveryError);
    expect(secondResult).toEqual(ok(new URL(anAuthorizationEndpoint)));
    expect(client.discovery).toHaveBeenCalledTimes(2);
  });

  it("returns OidcDiscoveryError when the environment is not configured", async () => {
    vi.mocked(oidcConfigPort.getConfig).mockReturnValue(
      err(new ValidationError("missing config")),
    );

    const result = await adapter.getAuthorizationEndpoint("UAT");

    const error = result._unsafeUnwrapErr();
    expect(error).toBeInstanceOf(OidcDiscoveryError);
    expect(error.message).toContain(
      "Missing OIDC configuration: Validation error: missing config",
    );
    expect(client.discovery).not.toHaveBeenCalled();
  });

  it("returns OidcDiscoveryError when discovery fails", async () => {
    vi.mocked(client.discovery).mockRejectedValue(new Error("discovery down"));

    const result = await adapter.getAuthorizationEndpoint("PROD");

    const error = result._unsafeUnwrapErr();
    expect(error).toBeInstanceOf(OidcDiscoveryError);
    expect(error.message).toContain("OIDC discovery failed: discovery down");
  });

  it("returns InvalidAuthorizationEndpointError when authorization_endpoint is missing", async () => {
    vi.mocked(client.discovery).mockResolvedValue(makeConfiguration(undefined));

    const result = await adapter.getAuthorizationEndpoint("PROD");

    const error = result._unsafeUnwrapErr();
    expect(error).toBeInstanceOf(InvalidAuthorizationEndpointError);
    expect(error.message).toContain(
      "OIDC discovery metadata is missing authorization_endpoint",
    );
  });

  it("returns InvalidAuthorizationEndpointError when authorization_endpoint is not a valid URL", async () => {
    vi.mocked(client.discovery).mockResolvedValue(
      makeConfiguration("not-a-url"),
    );

    const result = await adapter.getAuthorizationEndpoint("PROD");

    const error = result._unsafeUnwrapErr();
    expect(error).toBeInstanceOf(InvalidAuthorizationEndpointError);
    expect(error.message).toContain(
      "Invalid authorization_endpoint from OIDC discovery: not-a-url",
    );
  });
});

describe("OpenIdClientAdapter#warmUp", () => {
  it("discovers configuration for the requested environments", async () => {
    await adapter.warmUp(new Set(["PROD", "UAT"]));

    expect(client.discovery).toHaveBeenCalledTimes(2);
  });

  it("skips environments that are not configured", async () => {
    vi.mocked(oidcConfigPort.getConfig).mockImplementation((env) =>
      env === "PROD"
        ? ok(anEnvConfig)
        : err(new ValidationError("missing config")),
    );

    await adapter.warmUp(new Set(["PROD", "UAT"]));

    expect(client.discovery).toHaveBeenCalledTimes(1);
  });

  it("swallows discovery failures so startup is not blocked", async () => {
    vi.mocked(client.discovery).mockRejectedValue(new Error("discovery down"));

    await expect(adapter.warmUp(new Set(["PROD"]))).resolves.toBeUndefined();
  });
});
