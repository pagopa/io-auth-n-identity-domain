import { describe, expect, it } from "vitest";

import { LollipopContextSchema } from "../index.js";

import { validHeaders, validLcParams } from "../../__mocks__/lollipop.mock.js";

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
