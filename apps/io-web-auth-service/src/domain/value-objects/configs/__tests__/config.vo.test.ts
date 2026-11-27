import { describe, expect, it } from "vitest";

import { ConfigSchema } from "../config.vo.js";

const developmentConfig = {
  NODE_ENV: "development",
  HOST: "127.0.0.1",
  PORT: "3000",
  ONEID_PROD_CLIENT_ID: "prod-client-id",
  ONEID_PROD_CLIENT_SECRET: "prod-client-secret",
  ONEID_PROD_ISSUER: "https://oneid.example.com",
  ONEID_PROD_REDIRECT_URI: "https://app.example.com/callback",
  REDIS_HOSTNAME: "localhost",

  JWT_TOKEN_ISSUER: "io-web-auth-service",
  JWT_TOKEN_PRIVATE_KEY: "example",
  JWT_TOKEN_TTL_SECONDS: 3600,
  LOGIN_SUCCESS_REDIRECT_URL: "http://localhost:3000/success",
  LOGIN_ERROR_REDIRECT_URL: "http://localhost:3000/error",
};

describe("ConfigSchema", () => {
  it("treats blank UAT settings and a blank local Redis password as absent", () => {
    expect(
      ConfigSchema.parse({
        ...developmentConfig,
        ONEID_UAT_CLIENT_ID: "",
        ONEID_UAT_CLIENT_SECRET: "",
        ONEID_UAT_ISSUER: "",
        REDIS_PASSWORD: "",
      }),
    ).toMatchObject({
      ONEID_UAT_CLIENT_ID: undefined,
      ONEID_UAT_CLIENT_SECRET: undefined,
      ONEID_UAT_ISSUER: undefined,
      REDIS_PASSWORD: undefined,
    });
  });

  it("still rejects a nonempty invalid UAT issuer", () => {
    expect(
      ConfigSchema.safeParse({
        ...developmentConfig,
        ONEID_UAT_ISSUER: "not-a-url",
      }).success,
    ).toBe(false);
  });
});
