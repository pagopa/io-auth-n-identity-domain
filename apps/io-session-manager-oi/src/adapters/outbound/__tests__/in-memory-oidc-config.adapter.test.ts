import { ValidationError } from "@pagopa/hexagonal-core";
import { describe, expect, it } from "vitest";

import { OneIdConfigSchema } from "../../../domain/value-objects/configs/one-id.vo.js";
import { InMemoryOidcConfigAdapter } from "../in-memory-oidc-config.adapter.js";

const PROD_ISSUER = "https://oneid.example.com";
const UAT_ISSUER = "https://uat-oneid.example.com";
const REDIRECT_URI = "https://app.example.com/callback";

const aProdConfig = {
  ONEID_PROD_CLIENT_ID: "prod-client-id",
  ONEID_PROD_CLIENT_SECRET: "prod-client-secret",
  ONEID_PROD_ISSUER: PROD_ISSUER,
  ONEID_PROD_REDIRECT_URI: REDIRECT_URI,
};

describe("InMemoryOidcConfigAdapter", () => {
  it("returns the required PROD configuration with parsed URL values", () => {
    const config = OneIdConfigSchema.parse(aProdConfig);
    const result = new InMemoryOidcConfigAdapter(config).getConfig("PROD");

    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toEqual({
      clientId: "prod-client-id",
      clientSecret: "prod-client-secret",
      baseUrl: new URL(PROD_ISSUER),
      redirectUri: new URL(REDIRECT_URI),
    });
  });

  it("returns a validation error when UAT is not configured", () => {
    const config = OneIdConfigSchema.parse(aProdConfig);
    const result = new InMemoryOidcConfigAdapter(config).getConfig("UAT");

    expect(result._unsafeUnwrapErr()).toEqual(
      new ValidationError('Missing OIDC configuration for environment "UAT"'),
    );
  });

  it("returns UAT configuration only when all UAT values are present", () => {
    const config = OneIdConfigSchema.parse({
      ...aProdConfig,
      ONEID_UAT_CLIENT_ID: "uat-client-id",
      ONEID_UAT_CLIENT_SECRET: "uat-client-secret",
      ONEID_UAT_ISSUER: UAT_ISSUER,
    });
    const result = new InMemoryOidcConfigAdapter(config).getConfig("UAT");

    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toEqual({
      clientId: "uat-client-id",
      clientSecret: "uat-client-secret",
      baseUrl: new URL(UAT_ISSUER),
      redirectUri: new URL(REDIRECT_URI),
    });
  });

  it.each([
    { ONEID_UAT_CLIENT_ID: "uat-client-id" },
    { ONEID_UAT_CLIENT_SECRET: "uat-client-secret" },
    { ONEID_UAT_ISSUER: UAT_ISSUER },
  ])("does not configure partial UAT values: %o", (uatConfig) => {
    const config = OneIdConfigSchema.parse({ ...aProdConfig, ...uatConfig });
    const result = new InMemoryOidcConfigAdapter(config).getConfig("UAT");

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toEqual(
      new ValidationError('Missing OIDC configuration for environment "UAT"'),
    );
  });
});
