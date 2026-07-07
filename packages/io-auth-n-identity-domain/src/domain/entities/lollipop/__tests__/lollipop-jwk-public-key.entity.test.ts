import { describe, expect, it } from "vitest";

import {
  EcKeySchema,
  JwkPublicKeyBase64UrlStringSchema,
  JwkPublicKeySchema,
  RsaKeySchema,
} from "../lollipop-jwk-public-key.entity.js";

const encode = (value: unknown): string =>
  Buffer.from(JSON.stringify(value)).toString("base64url");

const validEcKey = {
  alg: "ES256",
  crv: "P-256" as const,
  kty: "EC" as const,
  x: "abc",
  y: "def",
};

const validRsaKey = {
  alg: "RS256",
  e: "AQAB",
  kty: "RSA" as const,
  n: "modulus",
};

describe("EcKeySchema", () => {
  it("accepts a well-formed EC key", () => {
    const result = EcKeySchema.safeParse(validEcKey);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toStrictEqual(validEcKey);
    }
  });

  it.each(["P-256", "P-384", "P-521"] as const)("accepts crv %s", (crv) => {
    const result = EcKeySchema.safeParse({ ...validEcKey, crv });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.crv).toBe(crv);
    }
  });

  it("rejects an unsupported crv value", () => {
    expect(EcKeySchema.safeParse({ ...validEcKey, crv: "P-192" }).success).toBe(
      false,
    );
  });

  it("rejects when kty is not 'EC'", () => {
    expect(EcKeySchema.safeParse({ ...validEcKey, kty: "RSA" }).success).toBe(
      false,
    );
  });
});

describe("RsaKeySchema", () => {
  it("accepts a well-formed RSA key", () => {
    const result = RsaKeySchema.safeParse(validRsaKey);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toStrictEqual(validRsaKey);
    }
  });

  it("rejects when kty is not 'RSA'", () => {
    expect(RsaKeySchema.safeParse({ ...validRsaKey, kty: "EC" }).success).toBe(
      false,
    );
  });

  it("rejects when a required field is missing", () => {
    const { n: _n, ...withoutN } = validRsaKey;
    expect(RsaKeySchema.safeParse(withoutN).success).toBe(false);
  });
});

describe("JwkPublicKeySchema", () => {
  it.each([
    { kind: "EC", key: validEcKey },
    { kind: "RSA", key: validRsaKey },
  ])("accepts a valid $kind JWK", ({ key }) => {
    const result = JwkPublicKeySchema.safeParse(key);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toStrictEqual(key);
    }
  });

  it("rejects an object with an unknown kty", () => {
    expect(
      JwkPublicKeySchema.safeParse({ ...validEcKey, kty: "oct" }).success,
    ).toBe(false);
  });

  it("rejects an object missing the kty discriminator", () => {
    const { kty: _kty, ...withoutKty } = validEcKey;
    expect(JwkPublicKeySchema.safeParse(withoutKty).success).toBe(false);
  });
});

describe("JwkPublicKeyBase64UrlStringSchema", () => {
  it.each([
    { kind: "EC", key: validEcKey },
    { kind: "RSA", key: validRsaKey },
  ])("decodes and validates a Base64url-encoded $kind JWK", ({ key }) => {
    const result = JwkPublicKeyBase64UrlStringSchema.safeParse(encode(key));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toStrictEqual(key);
    }
  });

  it("yields a fully typed JwkPublicKey (not the raw string)", () => {
    const result = JwkPublicKeyBase64UrlStringSchema.safeParse(
      encode(validEcKey),
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.kty).toBe("EC");
    }
  });

  it("surfaces inner Zod field paths for JWK-shape errors", () => {
    const result = JwkPublicKeyBase64UrlStringSchema.safeParse(
      encode({ ...validEcKey, crv: "P-192" }),
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join("."));
      expect(paths).toContain("crv");
    }
  });

  it.each`
    scenario                                                           | input
    ${"empty string"}                                                  | ${""}
    ${"plain string that is not Base64url"}                            | ${"not base64url!"}
    ${"Base64url string decoding to a non-object JSON value"}          | ${encode("just a string")}
    ${"Base64url string decoding to a JSON object without kty"}        | ${encode({ foo: "bar" })}
    ${"Base64url string decoding to a JSON object with unknown kty"}   | ${encode({ kty: "oct", k: "abc" })}
    ${"Base64url string decoding to an EC JWK with unsupported crv"}   | ${encode({ ...validEcKey, crv: "P-192" })}
    ${"Base64url string decoding to an EC JWK missing required field"} | ${encode({ kty: "EC", crv: "P-256", x: "abc" })}
    ${"Base64url string that is not valid JSON"}                       | ${Buffer.from("{invalid}").toString("base64url")}
  `("rejects $scenario", ({ input }) => {
    expect(JwkPublicKeyBase64UrlStringSchema.safeParse(input).success).toBe(
      false,
    );
  });
});
