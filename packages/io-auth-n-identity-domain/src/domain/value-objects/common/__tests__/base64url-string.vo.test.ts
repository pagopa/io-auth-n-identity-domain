import { describe, expect, it } from "vitest";

import {
  Base64UrlJsonSchema,
  Base64UrlStringSchema,
} from "../base64url-string.vo.js";

const encode = (value: unknown): string =>
  Buffer.from(JSON.stringify(value)).toString("base64url");

describe("Base64UrlStringSchema", () => {
  it.each([
    "abc",
    "ABC-_",
    "0123456789",
    "aZ09-_",
    Buffer.from("hello world").toString("base64url"),
  ])("accepts the valid Base64url string %j", (input) => {
    expect(Base64UrlStringSchema.safeParse(input).success).toBe(true);
  });

  it.each`
    scenario                               | input
    ${"empty string"}                      | ${""}
    ${"contains a space"}                  | ${"abc def"}
    ${"contains standard Base64 '+' char"} | ${"ab+cd"}
    ${"contains standard Base64 '/' char"} | ${"ab/cd"}
    ${"contains Base64 padding '='"}       | ${"abcd="}
    ${"contains non-ASCII characters"}     | ${"caffè"}
    ${"is not a string (number)"}          | ${42}
    ${"is not a string (null)"}            | ${null}
    ${"is not a string (undefined)"}       | ${undefined}
    ${"is not a string (object)"}          | ${{ a: 1 }}
  `("rejects when input $scenario", ({ input }) => {
    expect(Base64UrlStringSchema.safeParse(input).success).toBe(false);
  });
});

describe("Base64UrlJsonSchema", () => {
  it.each([
    { kind: "object", value: { a: 1, b: "two" } },
    { kind: "array", value: [1, 2, 3] },
    { kind: "string", value: "hello" },
    { kind: "number", value: 42 },
    { kind: "boolean", value: true },
    { kind: "null", value: null },
  ])("decodes a Base64url payload wrapping a JSON $kind", ({ value }) => {
    const result = Base64UrlJsonSchema.safeParse(encode(value));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toStrictEqual(value);
    }
  });

  it("rejects an input that is not a valid Base64url string", () => {
    const result = Base64UrlJsonSchema.safeParse("not base64url!");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("Invalid Base64url string");
    }
  });

  it("rejects a Base64url string whose decoded content is not valid JSON", () => {
    const invalidJson = Buffer.from("{not json").toString("base64url");
    const result = Base64UrlJsonSchema.safeParse(invalidJson);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(
        "Invalid Base64url-encoded JSON",
      );
    }
  });

  it("rejects an empty string", () => {
    expect(Base64UrlJsonSchema.safeParse("").success).toBe(false);
  });
});
