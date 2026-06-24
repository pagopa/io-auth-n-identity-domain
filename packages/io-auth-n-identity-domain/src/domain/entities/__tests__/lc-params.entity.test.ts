import { describe, expect, it } from "vitest";

import { LcParamsSchema } from "../index.js";
import { validLcParams } from "../../__mocks__/lollipop.mock.js";

describe("LcParamsSchema", () => {
  it("accepts valid LC params", () => {
    expect(LcParamsSchema.safeParse(validLcParams).success).toBe(true);
  });

  it("rejects an invalid fiscal code", () => {
    const result = LcParamsSchema.safeParse({
      ...validLcParams,
      fiscal_code: "NOT-A-VALID-CF",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an empty assertion_ref", () => {
    const result = LcParamsSchema.safeParse({
      ...validLcParams,
      assertion_ref: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an empty lc_authentication_bearer", () => {
    const result = LcParamsSchema.safeParse({
      ...validLcParams,
      lc_authentication_bearer: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing pub_key", () => {
    const { pub_key: _, ...withoutPubKey } = validLcParams;
    expect(LcParamsSchema.safeParse(withoutPubKey).success).toBe(false);
  });

  it("rejects a pub_key that is not a valid Base64url string", () => {
    const result = LcParamsSchema.safeParse({
      ...validLcParams,
      pub_key: "not base64url!!!",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a pub_key that is Base64url but not a JWK", () => {
    // Base64url of `{"foo":"bar"}` — valid Base64url, valid JSON, but no `kty`
    const notAJwk = Buffer.from(JSON.stringify({ foo: "bar" })).toString(
      "base64url",
    );
    const result = LcParamsSchema.safeParse({
      ...validLcParams,
      pub_key: notAJwk,
    });
    expect(result.success).toBe(false);
  });
});
