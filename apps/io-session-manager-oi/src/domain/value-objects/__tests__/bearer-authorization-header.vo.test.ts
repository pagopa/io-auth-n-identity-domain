import { describe, expect, it } from "vitest";

import { BearerAuthorizationHeaderSchema } from "../bearer-authorization-header.vo.js";

describe("BearerAuthorizationHeaderSchema", () => {
  it("strips the 'Bearer ' prefix from a valid header", () => {
    const result = BearerAuthorizationHeaderSchema.safeParse("Bearer abc.def");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe("abc.def");
    }
  });

  it("rejects an empty token", () => {
    const result = BearerAuthorizationHeaderSchema.safeParse("Bearer ");

    expect(result.success).toBe(false);
    expect(result.error!.issues[0].message).toBe(
      "Authorization header must contain a non-empty token",
    );
  });

  it.each`
    scenario                      | input
    ${"missing 'Bearer ' prefix"} | ${"abc.def"}
    ${"wrong scheme"}             | ${"Basic abc.def"}
    ${"lowercase prefix"}         | ${"bearer abc.def"}
    ${"empty string"}             | ${""}
  `("rejects invalid input ($scenario)", ({ input }) => {
    const result = BearerAuthorizationHeaderSchema.safeParse(input);

    expect(result.success).toBe(false);
    expect(result.error!.issues[0].message).toBe(
      `Expected 'Bearer <token>' authorization header`,
    );
  });
});
