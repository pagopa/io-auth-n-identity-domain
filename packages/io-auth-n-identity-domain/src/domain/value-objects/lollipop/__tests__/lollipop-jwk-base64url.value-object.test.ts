import { describe, expect, it } from "vitest";

import { LollipopPublicKeySchema } from "../lollipop-public-key.value-object.js";

const toBase64Url = (value: unknown): string =>
  Buffer.from(JSON.stringify(value)).toString("base64url");

describe("LollipopPublicKeySchema", () => {
  it.each([
    { kty: "EC", crv: "P-256", x: "abc", y: "def" },
    { kty: "RSA", n: "modulus", e: "AQAB" },
  ])('accepts a Base64url-encoded JWK with kty "%s"', (jwk) => {
    const base64urlJwk = Buffer.from(JSON.stringify(jwk)).toString("base64url");
    expect(LollipopPublicKeySchema.safeParse(base64urlJwk).success).toBe(true);
  });

  it.each`
    scenario                                                                   | input
    ${"Rejects an empty string"}                                               | ${""}
    ${"Rejects a plain string that is not Base64url"}                          | ${"Not base64url"}
    ${"Rejects a Base64url string that decodes to a non-object JSON value"}    | ${toBase64Url("Just a string")}
    ${"Rejects a Base64url string that decodes to a JSON object without kty"}  | ${toBase64Url({ foo: "bar" })}
    ${"Rejects a Base64url string that decodes to JSON with a non-string kty"} | ${toBase64Url({ kty: 42 })}
    ${"Rejects a Base64url string that is not valid JSON"}                     | ${Buffer.from("{invalid}").toString("base64url")}
  `("should return $scenario", ({ input }) => {
    expect(LollipopPublicKeySchema.safeParse(input).success).toBe(false);
  });
});
