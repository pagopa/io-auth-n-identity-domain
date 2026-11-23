import { NonEmptyStringSchema } from "@pagopa/hexagonal-core";
import { describe, expect, it } from "vitest";

import { toAuthorizationRequestUrl } from "../login.handler.js";

describe("toAuthorizationRequestUrl", () => {
  it("builds the OIDC authorization URL without losing existing query parameters", () => {
    const url = new URL(
      toAuthorizationRequestUrl({
        authorizationEndpoint: new URL(
          "https://oneid.example.com/oidc/authorize?tenant=test",
        ),
        clientId: NonEmptyStringSchema.parse("web-client"),
        redirectUri: new URL(
          "https://web.example.com/callback?flow=web&source=test",
        ),
        scope: "openid",
        state: NonEmptyStringSchema.parse("state+value"),
        nonce: NonEmptyStringSchema.parse("nonce-value"),
        responseType: "code",
        acrValues: "https://www.spid.gov.it/SpidL2",
        idp: NonEmptyStringSchema.parse("https://idp.example.com"),
      }),
    );

    expect(url.origin).toBe("https://oneid.example.com");
    expect(url.pathname).toBe("/oidc/authorize");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      tenant: "test",
      client_id: "web-client",
      redirect_uri: "https://web.example.com/callback?flow=web&source=test",
      scope: "openid",
      state: "state+value",
      nonce: "nonce-value",
      response_type: "code",
      acr_values: "https://www.spid.gov.it/SpidL2",
      idp: "https://idp.example.com",
    });
  });
});
