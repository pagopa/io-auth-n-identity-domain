import crypto from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  BearerAuthorizationHeaderSchema,
  SsoBpdUserOutputDTO,
} from "../sso-bpd-user.dto.js";

const aSessionId = "aValidSessionId";
const aPlainBpdSSOToken = crypto
  .createHash("sha256")
  .update("bpd:aPlainSessionToken")
  .digest("hex");
const aBpdClientSessionToken = `${aSessionId}.${aPlainBpdSSOToken}`;

describe("BearerAuthorizationHeaderSchema", () => {
  it("accepts a well-formed Bearer header", () => {
    const raw = `Bearer ${aBpdClientSessionToken}`;

    const result = BearerAuthorizationHeaderSchema.safeParse(raw);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe(raw);
    }
  });

  it.each`
    scenario                      | input
    ${"missing 'Bearer ' prefix"} | ${aBpdClientSessionToken}
    ${"wrong scheme"}             | ${`Basic ${aBpdClientSessionToken}`}
    ${"empty string"}             | ${""}
  `("rejects invalid input ($scenario)", ({ input }) => {
    expect(BearerAuthorizationHeaderSchema.safeParse(input).success).toBe(
      false,
    );
  });
});

describe("SsoBpdUserOutputDTO", () => {
  it("accepts a valid BPD user payload", () => {
    const result = SsoBpdUserOutputDTO.safeParse({
      name: "Mario",
      family_name: "Rossi",
      fiscal_code: "RSSMRA85T10A562X",
    });

    expect(result.success).toBe(true);
  });

  it.each`
    scenario                 | input
    ${"empty name"}          | ${{ name: "", family_name: "Rossi", fiscal_code: "RSSMRA85T10A562X" }}
    ${"empty family_name"}   | ${{ name: "Mario", family_name: "", fiscal_code: "RSSMRA85T10A562X" }}
    ${"invalid fiscal_code"} | ${{ name: "Mario", family_name: "Rossi", fiscal_code: "not-a-cf" }}
    ${"missing name"}        | ${{ family_name: "Rossi", fiscal_code: "RSSMRA85T10A562X" }}
  `("rejects invalid payload ($scenario)", ({ input }) => {
    expect(SsoBpdUserOutputDTO.safeParse(input).success).toBe(false);
  });
});
