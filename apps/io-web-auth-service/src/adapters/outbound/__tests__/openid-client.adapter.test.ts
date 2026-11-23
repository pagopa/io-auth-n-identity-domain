import {
  GenericError,
  type NonEmptyString,
  ValidationError,
} from "@pagopa/hexagonal-core";
import { err, ok } from "neverthrow";
import * as client from "openid-client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  type OidcConfig,
  type OidcConfigPort,
} from "../../../domain/ports/outbound/oidc-config.port.js";
import { OpenIdClientAdapter } from "../openid-client.adapter.js";

vi.mock("openid-client", () => ({
  discovery: vi.fn(),
  ClientSecretBasic: vi.fn(() => "client-secret-basic"),
  customFetch: Symbol("customFetch"),
}));

const anIssuer = "https://uat.oneid.pagopa.it";
const anAuthorizationEndpoint = `${anIssuer}/oidc/authorize`;

const anEnvConfig: OidcConfig = {
  clientId: "a-client-id" as NonEmptyString,
  clientSecret: "a-client-secret" as NonEmptyString,
  baseUrl: new URL(anIssuer),
  redirectUri: new URL("https://api-web.io.pagopa.it/ioweb/auth/v2/callback"),
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

let adapter: OpenIdClientAdapter;

beforeEach(() => {
  vi.clearAllMocks();
  adapter = new OpenIdClientAdapter(oidcConfigPort, 5);
  vi.mocked(oidcConfigPort.getConfig).mockReturnValue(ok(anEnvConfig));
  vi.mocked(client.discovery).mockResolvedValue(aConfiguration);
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

    expect(firstResult).toEqual(
      err({
        reason: "discovery_failed",
        error: new GenericError("OIDC discovery failed: discovery down"),
      }),
    );
    expect(secondResult).toEqual(ok(new URL(anAuthorizationEndpoint)));
    expect(client.discovery).toHaveBeenCalledTimes(2);
  });

  it("returns err(GenericError) when the environment is not configured", async () => {
    vi.mocked(oidcConfigPort.getConfig).mockReturnValue(
      err(new ValidationError("missing config")),
    );

    const result = await adapter.getAuthorizationEndpoint("UAT");

    expect(result).toEqual(
      err({
        reason: "discovery_failed",
        error: new GenericError(
          "Missing OIDC configuration: Validation error: missing config",
        ),
      }),
    );
    expect(client.discovery).not.toHaveBeenCalled();
  });

  it("returns err(GenericError) when discovery fails", async () => {
    vi.mocked(client.discovery).mockRejectedValue(new Error("discovery down"));

    const result = await adapter.getAuthorizationEndpoint("PROD");

    expect(result).toEqual(
      err({
        reason: "discovery_failed",
        error: new GenericError("OIDC discovery failed: discovery down"),
      }),
    );
  });

  it("returns err(GenericError) when authorization_endpoint is missing", async () => {
    vi.mocked(client.discovery).mockResolvedValue(makeConfiguration(undefined));

    const result = await adapter.getAuthorizationEndpoint("PROD");

    expect(result).toEqual(
      err({
        reason: "invalid_authorization_endpoint",
        error: new GenericError(
          "OIDC discovery metadata is missing authorization_endpoint",
        ),
      }),
    );
  });

  it("returns err(GenericError) when authorization_endpoint is not a valid URL", async () => {
    vi.mocked(client.discovery).mockResolvedValue(
      makeConfiguration("not-a-url"),
    );

    const result = await adapter.getAuthorizationEndpoint("PROD");

    expect(result).toEqual(
      err({
        reason: "invalid_authorization_endpoint",
        error: new GenericError(
          "Invalid authorization_endpoint from OIDC discovery: not-a-url",
        ),
      }),
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
