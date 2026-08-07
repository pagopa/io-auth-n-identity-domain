import {
  AuthenticationError,
  GenericError,
  type NonEmptyString,
  ValidationError,
} from "@pagopa/hexagonal-core";
import { err, ok } from "neverthrow";
import * as client from "openid-client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { OpenIdClientAdapter } from "../openid-client.adapter.js";
import {
  type OidcConfigPort,
  type OidcEnvConfig,
} from "../../../domain/ports/outbound/oidc-config.port.js";
import { type OidcExchangeParams } from "../../../domain/ports/outbound/oidc.port.js";
import { OidcClaimsSchema } from "../../../domain/value-objects/oidc-claims.vo.js";
import {
  aDateOfBirth,
  aFamilyName,
  aFiscalCode,
  aName,
  anEmailAddress,
  aSpidLevel,
} from "../../../__mocks__/session.mocks.js";
import { SpidLevelSchema } from "@pagopa/io-auth-n-identity-session";

vi.mock("openid-client", () => ({
  discovery: vi.fn(),
  authorizationCodeGrant: vi.fn(),
  ClientSecretBasic: vi.fn(() => "client-secret-basic"),
  customFetch: Symbol("customFetch"),
}));

const anIssuer = "https://uat.io.oneid.pagopa.it";

const anEnvConfig: OidcEnvConfig = {
  clientId: "a-client-id" as NonEmptyString,
  clientSecret: "a-client-secret" as NonEmptyString,
  baseUrl: new URL(anIssuer),
  redirectUri: new URL("https://app.example.com/api/auth/v2/callback"),
};

const aValidRawClaims = {
  fiscalNumber: aFiscalCode,
  name: aName,
  familyName: aFamilyName,
  email: anEmailAddress,
  dateOfBirth: aDateOfBirth,
  acr: aSpidLevel,
  iss: anIssuer,
};

const anExchangeParams: OidcExchangeParams = {
  env: "PROD",
  query: { code: "an-auth-code", state: "a-state" },
  expectedState: "a-state",
  expectedNonce: "a-nonce",
};

const aConfiguration = {} as client.Configuration;

const oidcConfigPort: OidcConfigPort = {
  getConfig: vi.fn(),
};

const makeTokens = (claims: unknown) => ({ claims: () => claims }) as never;

const anExpectedClaims = OidcClaimsSchema.parse(aValidRawClaims);

let adapter: OpenIdClientAdapter;

beforeEach(() => {
  vi.clearAllMocks();
  adapter = new OpenIdClientAdapter(oidcConfigPort);
  vi.mocked(oidcConfigPort.getConfig).mockReturnValue(ok(anEnvConfig));
  vi.mocked(client.discovery).mockResolvedValue(aConfiguration);
  vi.mocked(client.authorizationCodeGrant).mockResolvedValue(
    makeTokens(aValidRawClaims),
  );
});

describe("OpenIdClientAdapter#exchange", () => {
  it("returns ok(claims) with the validated OIDC claims on success", async () => {
    const result = await adapter.exchange(anExchangeParams);

    expect(result).toEqual(ok(anExpectedClaims));
  });

  it("forwards state and nonce to the authorization code grant", async () => {
    await adapter.exchange(anExchangeParams);

    expect(client.authorizationCodeGrant).toHaveBeenCalledWith(
      aConfiguration,
      expect.any(URL),
      expect.objectContaining({
        expectedState: anExchangeParams.expectedState,
        expectedNonce: anExchangeParams.expectedNonce,
        idTokenExpected: true,
      }),
      { nonce: anExchangeParams.expectedNonce },
    );
  });

  it("caches provider discovery across exchanges for the same environment", async () => {
    await adapter.exchange(anExchangeParams);
    await adapter.exchange(anExchangeParams);

    expect(client.discovery).toHaveBeenCalledTimes(1);
  });

  it("retries discovery on the next exchange after a failed discovery", async () => {
    vi.mocked(client.discovery).mockRejectedValueOnce(
      new Error("discovery down"),
    );

    const firstResult = await adapter.exchange(anExchangeParams);
    const secondResult = await adapter.exchange(anExchangeParams);

    expect(firstResult).toEqual(
      err(new GenericError("OIDC discovery failed: discovery down")),
    );
    expect(secondResult).toEqual(ok(anExpectedClaims));
    expect(client.discovery).toHaveBeenCalledTimes(2);
  });

  it("returns err(GenericError) when the environment is not configured", async () => {
    vi.mocked(oidcConfigPort.getConfig).mockReturnValue(
      err(new ValidationError("missing config")),
    );

    const result = await adapter.exchange(anExchangeParams);

    expect(result).toEqual(
      err(
        new GenericError(
          "Missing OIDC configuration: Validation error: missing config",
        ),
      ),
    );
    expect(client.discovery).not.toHaveBeenCalled();
  });

  it("returns err(GenericError) when discovery fails", async () => {
    vi.mocked(client.discovery).mockRejectedValue(new Error("discovery down"));

    const result = await adapter.exchange(anExchangeParams);

    expect(result).toEqual(
      err(new GenericError("OIDC discovery failed: discovery down")),
    );
  });

  it("returns err(AuthenticationError) when the token response has no claims", async () => {
    vi.mocked(client.authorizationCodeGrant).mockResolvedValue(
      makeTokens(undefined),
    );

    const result = await adapter.exchange(anExchangeParams);

    expect(result).toEqual(err(new AuthenticationError()));
  });

  it("returns err(GenericError) when the claims fail schema validation", async () => {
    vi.mocked(client.authorizationCodeGrant).mockResolvedValue(
      makeTokens({ ...aValidRawClaims, fiscalNumber: "not-a-fiscal-code" }),
    );

    const result = await adapter.exchange(anExchangeParams);

    expect(result).toEqual(err(new GenericError("Invalid OIDC claims")));
  });

  it("returns err(AuthenticationError) when the authorization code grant throws", async () => {
    vi.mocked(client.authorizationCodeGrant).mockRejectedValue(
      new Error("invalid code"),
    );

    const result = await adapter.exchange(anExchangeParams);

    expect(result).toEqual(err(new AuthenticationError()));
  });
});

describe("OpenIdClientAdapter#warmUp", () => {
  it("discovers configuration for the requested environments", async () => {
    await adapter.warmUp(["PROD", "UAT"]);

    expect(client.discovery).toHaveBeenCalledTimes(2);
  });

  it("skips environments that are not configured", async () => {
    vi.mocked(oidcConfigPort.getConfig).mockImplementation((env) =>
      env === "PROD"
        ? ok(anEnvConfig)
        : err(new ValidationError("missing config")),
    );

    await adapter.warmUp(["PROD", "UAT"]);

    expect(client.discovery).toHaveBeenCalledTimes(1);
  });

  it("swallows discovery failures so startup is not blocked", async () => {
    vi.mocked(client.discovery).mockRejectedValue(new Error("discovery down"));

    await expect(adapter.warmUp(["PROD"])).resolves.toBeUndefined();
  });
});
