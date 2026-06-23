import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  LcParamsSchema,
  LollipopContextSchema,
  LollipopRequiredHeadersSchema,
} from "../lollipop.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Computes a `content-digest` header value for the given algorithm and body,
 * using the format defined in RFC 9530:
 *   `<algorithm>=:<base64-encoded-digest>:`
 */
const computeContentDigest = (
  algorithm: "sha-256" | "sha-384" | "sha-512",
  body: string,
): string => {
  // The content-digest header format uses hyphens: sha-256, sha-384, sha-512
  // but the Node.js crypto module uses the same names without hyphens: sha256, sha384, sha512
  const digest = createHash(algorithm.replace(/-/g, "")).update(body).digest("base64");
  return `${algorithm}=:${digest}:`;
};

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const validHeaders = {
  signature: "sig1=:AAAA=:",
  "signature-input": 'sig1=("@method");nonce="test-nonce"',
  "x-pagopa-lollipop-original-method": "GET",
  "x-pagopa-lollipop-original-url": "https://example.com/api/resource",
};

const validLcParams = {
  assertion_ref: "sha256-abc123",
  assertion_type: "SAML",
  fiscal_code: "RSSMRA85M01H501U",
  lc_authentication_bearer: "eyJhbGciOiJSUzI1NiJ9.test.sig",
  pub_key: "eyJrdHkiOiJFQyJ9",
};

// ---------------------------------------------------------------------------
// LollipopRequiredHeadersSchema
// ---------------------------------------------------------------------------

describe("LollipopRequiredHeadersSchema", () => {
  it("accepts valid required headers", () => {
    expect(LollipopRequiredHeadersSchema.safeParse(validHeaders).success).toBe(
      true,
    );
  });

  it.each([
    "sha-256",
    "sha-384",
    "sha-512",
  ] as const)("accepts valid headers with an optional %s content-digest", (algorithm) => {
    const result = LollipopRequiredHeadersSchema.safeParse({
      ...validHeaders,
      "content-digest": computeContentDigest(algorithm, "test body"),
    });
    expect(result.success).toBe(true);
  });

  it("rejects a missing signature header", () => {
    const { signature: _, ...withoutSignature } = validHeaders;
    expect(
      LollipopRequiredHeadersSchema.safeParse(withoutSignature).success,
    ).toBe(false);
  });

  it("rejects a missing signature-input header", () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { "signature-input": _, ...rest } = validHeaders;
    expect(LollipopRequiredHeadersSchema.safeParse(rest).success).toBe(false);
  });

  it("rejects a signature that does not match the expected pattern", () => {
    const result = LollipopRequiredHeadersSchema.safeParse({
      ...validHeaders,
      signature: "not-a-valid-signature",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a signature-input that does not match the expected pattern", () => {
    const result = LollipopRequiredHeadersSchema.safeParse({
      ...validHeaders,
      "signature-input": "invalid!!",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an HTTP (non-HTTPS) original URL", () => {
    const result = LollipopRequiredHeadersSchema.safeParse({
      ...validHeaders,
      "x-pagopa-lollipop-original-url": "http://example.com/api",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown HTTP method", () => {
    const result = LollipopRequiredHeadersSchema.safeParse({
      ...validHeaders,
      "x-pagopa-lollipop-original-method": "HEAD",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a content-digest with an invalid format", () => {
    const result = LollipopRequiredHeadersSchema.safeParse({
      ...validHeaders,
      "content-digest": "md5=:abc:",
    });
    expect(result.success).toBe(false);
  });

  it.each([
    "GET",
    "POST",
    "PUT",
    "PATCH",
    "DELETE",
  ] as const)("accepts all valid HTTP methods", (method) => {
    const result = LollipopRequiredHeadersSchema.safeParse({
      ...validHeaders,
      "x-pagopa-lollipop-original-method": method,
    });
    expect(result.success, `expected ${method} to be valid`).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// LcParamsSchema
// ---------------------------------------------------------------------------

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
});

// ---------------------------------------------------------------------------
// LollipopContextSchema
// ---------------------------------------------------------------------------

describe("LollipopContextSchema", () => {
  it("accepts a valid context combining headers and LC params", () => {
    const result = LollipopContextSchema.safeParse({
      requestHeaders: validHeaders,
      lcParams: validLcParams,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a context with invalid headers", () => {
    const result = LollipopContextSchema.safeParse({
      requestHeaders: { ...validHeaders, signature: "bad" },
      lcParams: validLcParams,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a context with invalid LC params", () => {
    const result = LollipopContextSchema.safeParse({
      requestHeaders: validHeaders,
      lcParams: { ...validLcParams, fiscal_code: "INVALID" },
    });
    expect(result.success).toBe(false);
  });
});
