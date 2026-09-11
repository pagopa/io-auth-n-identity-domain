import { describe, expect, it } from "vitest";

import { SsoBpdUserOutputDTO } from "../sso-bpd-user.dto.js";

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
