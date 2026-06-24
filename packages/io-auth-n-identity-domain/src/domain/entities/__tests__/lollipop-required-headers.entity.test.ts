import { describe, expect, it } from "vitest";

import { LollipopRequiredHeadersSchema } from "../index.js";

import {
  computeContentDigest,
  validHeaders,
} from "../../__mocks__/lollipop.mock.js";

describe("LollipopRequiredHeadersSchema", () => {
  it("accepts valid required headers", () => {
    expect(LollipopRequiredHeadersSchema.safeParse(validHeaders).success).toBe(
      true,
    );
  });

  it.each(["sha-256", "sha-384", "sha-512"] as const)(
    "accepts valid headers with an optional %s content-digest",
    (algorithm) => {
      const result = LollipopRequiredHeadersSchema.safeParse({
        ...validHeaders,
        "content-digest": computeContentDigest(algorithm, "test body"),
      });
      expect(result.success).toBe(true);
    },
  );

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

  it.each(["GET", "POST", "PUT", "PATCH", "DELETE"] as const)(
    "accepts all valid HTTP methods",
    (method) => {
      const result = LollipopRequiredHeadersSchema.safeParse({
        ...validHeaders,
        "x-pagopa-lollipop-original-method": method,
      });
      expect(result.success, `expected ${method} to be valid`).toBe(true);
    },
  );
});
