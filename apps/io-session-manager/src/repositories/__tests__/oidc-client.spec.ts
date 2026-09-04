import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  discoveryByEnv,
  getOidcConfiguration,
  sanitizingFetch,
} from "../oidc-client";
import type * as client from "openid-client" with { "resolution-mode": "import" };
import { OidcEnvConfig } from "../../config/one-id";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { UrlFromString } from "@pagopa/ts-commons/lib/url";
import * as E from "fp-ts/lib/Either";
import { OidcConfigurationEnvEnum } from "../../generated/backend/OidcConfigurationEnv";

const anIssuer = (
  UrlFromString.decode("https://localhost/prod") as E.Right<UrlFromString>
).right;
const aRedirectUri = (
  UrlFromString.decode(
    "https://app.example.com/api/auth/v2/callback",
  ) as E.Right<UrlFromString>
).right;

const anEnvConfig: OidcEnvConfig = {
  clientId: "a-client-id" as NonEmptyString,
  clientSecret: "a-client-secret" as NonEmptyString,
  issuer: anIssuer,
  redirectUri: aRedirectUri,
};
const aConfiguration = {
  serverMetadata: () => ({
    authorization_endpoint: "https://localhost/prod",
  }),
} as client.Configuration;

vi.mock("openid-client", () => ({
  discovery: vi.fn().mockReturnValue(aConfiguration),
  authorizationCodeGrant: vi.fn(),
  ClientSecretBasic: vi.fn(() => "client-secret-basic"),
  customFetch: Symbol("customFetch"),
}));

describe("getOidcConfiguration", async () => {
  beforeEach(() => {
    vi.clearAllMocks();
    discoveryByEnv.clear();
  });
  const client = await import("openid-client");

  it("returns a reject on discovery failures", async () => {
    const anError = new Error("discovery down");
    vi.mocked(client.discovery).mockRejectedValueOnce(anError);

    try {
      await getOidcConfiguration(OidcConfigurationEnvEnum.PROD, anEnvConfig, 8);
    } catch (err) {
      expect(err).toEqual(anError);
    }
  });

  it("returns a reject on discovery throw", async () => {
    const anError = Error("an error occurred");
    vi.mocked(client.discovery).mockImplementationOnce(() => {
      throw anError;
    });

    try {
      await getOidcConfiguration(OidcConfigurationEnvEnum.PROD, anEnvConfig, 8);
    } catch (err) {
      expect(err).toEqual(anError);
    }
  });

  it("discovers configuration for the requested environments", async () => {
    await getOidcConfiguration(OidcConfigurationEnvEnum.PROD, anEnvConfig, 8);

    expect(client.discovery).toHaveBeenCalledExactlyOnceWith(
      new URL(anIssuer.href),
      "a-client-id",
      {
        client_secret: "a-client-secret",
      },
      "client-secret-basic",
      {
        timeout: 8,
        [client.customFetch]: sanitizingFetch,
      },
    );
  });

  it("should enable recovery on second discovery try", async () => {
    vi.mocked(client.discovery).mockRejectedValueOnce(
      Error("an error occurred"),
    );

    try {
      await getOidcConfiguration(OidcConfigurationEnvEnum.PROD, anEnvConfig, 8);
    } catch {}

    expect(discoveryByEnv.size).toEqual(0);
    await getOidcConfiguration(OidcConfigurationEnvEnum.PROD, anEnvConfig, 8);

    expect(client.discovery).toHaveBeenCalledTimes(2);
    expect(discoveryByEnv).toEqual(
      new Map().set(
        OidcConfigurationEnvEnum.PROD,
        Promise.resolve(aConfiguration),
      ),
    );
  });
});
