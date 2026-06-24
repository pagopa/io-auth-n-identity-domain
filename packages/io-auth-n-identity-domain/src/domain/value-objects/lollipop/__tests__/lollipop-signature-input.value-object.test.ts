import { describe, expect, it } from "vitest";

import { LollipopSignatureInputSchema } from "../lollipop-signature-input.value-object.js";

import {
  aValidMultiSignatureInput,
  aValidSingleSignatureInput,
} from "../../../__mocks__/lollipop-signature-input.mock.js";

describe("LollipopSignatureInputSchema", () => {
  it.each`
    scenario                                  | input
    ${"accepts valid single signature input"} | ${aValidSingleSignatureInput}
    ${"accepts valid multi signature input"}  | ${aValidMultiSignatureInput}
  `("$scenario", ({ input }) => {
    expect(LollipopSignatureInputSchema.safeParse(input).success).toBe(true);
  });

  it.each`
    scenario                               | input
    ${"rejects empty string"}              | ${""}
    ${"rejects label with wrong prefix"}   | ${'key1=("@method")'}
    ${"rejects label without = separator"} | ${'sig1("@method")'}
  `("$scenario", ({ input }) => {
    expect(LollipopSignatureInputSchema.safeParse(input).success).toBe(false);
  });

  it("should be safe process a string that cause a ReDOS on the old regex ^(((sig[0-9]+)=[^,]*?)(, ?)?)+$", () => {
    // The following string is an example of input value that can execute a ReDOS
    // attack over the old regex "^(((sig[0-9]+)=[^,]*?)(, ?)?)+$"
    const attackValue = "sig0=, " + "sig0=sig0=, ".repeat(27) + ",s";
    expect(LollipopSignatureInputSchema.safeParse(attackValue).success).toBe(
      false,
    );
  });

  it("should reject an invalid string input", () => {
    expect(LollipopSignatureInputSchema.safeParse("anInvalidStringInput").success).toBe(false);
  });
});
