import { describe, expect, it } from "vitest";

import { ReserveInputDTO, ReserveOutputDTO } from "../reserve-pub-key.dto.js";

const aPublicKey = Buffer.from(
  JSON.stringify({
    crv: "P-256",
    kty: "EC",
    x: "NYvuK5KwdMSelFJgPnL0fsxizwOKw0WbQyANB4O6l2c",
    y: "qK9Zyso1CCwsUk985hnO5WEP3enSxpuD1n5JqtmZIEE",
  }),
).toString("base64url");

const aValidReserveRequest = {
  env: "PROD",
  min_auth_level: "SpidL2",
  lollipop_pub_key: aPublicKey,
  lollipop_hash_algo: "sha256",
};

describe("ReserveInputDTO", () => {
  it.each(["PROD", "UAT"])("accepts the %s environment", (env) => {
    const parsed = ReserveInputDTO.body.parse({
      ...aValidReserveRequest,
      env,
    });

    expect(parsed.env).toBe(env);
    expect(parsed.login_type).toBe("LEGACY");
    expect(parsed.current_user).toBeUndefined();
  });

  it("preserves the requested login type and current user", () => {
    const parsed = ReserveInputDTO.body.parse({
      ...aValidReserveRequest,
      login_type: "LV",
      current_user: "current-user-id",
    });

    expect(parsed.login_type).toBe("LV");
    expect(parsed.current_user).toBe("current-user-id");
  });

  it.each(["DEV", "prod", ""])("rejects invalid environment %j", (env) => {
    expect(
      ReserveInputDTO.body.safeParse({ ...aValidReserveRequest, env }).success,
    ).toBe(false);
  });

  it("rejects an invalid public key", () => {
    expect(
      ReserveInputDTO.body.safeParse({
        ...aValidReserveRequest,
        lollipop_pub_key: "not-a-jwk",
      }).success,
    ).toBe(false);
  });
});

describe("ReserveOutputDTO", () => {
  it("accepts the authorization parameters returned by the reserve flow", () => {
    expect(
      ReserveOutputDTO.safeParse({
        client_id: "a-client-id",
        state: "a-state",
        nonce: "a-nonce",
        redirect_uri: "https://app.example.com/callback",
        authorization_endpoint: "https://oneid.example.com/authorize",
      }).success,
    ).toBe(true);
  });
});
