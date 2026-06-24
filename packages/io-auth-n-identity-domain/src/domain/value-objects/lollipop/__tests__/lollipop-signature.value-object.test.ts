import { describe, expect, it } from "vitest";

import { LollipopSignatureSchema } from "../lollipop-signature.value-object.js";
import { aLollipopSignature } from "../../../__mocks__/lollipop.mock.js";

describe("LollipopSignatureSchema", () => {
  it.each([
    "sig1=:AAAA=:",
    "sig1=:abc123+/=:",
    "sig1=:BASE64:, sig2=:MORE64:",
    "sig1=:A:,sig2=:B:",
    aLollipopSignature,
  ])('accepts "%s"', (value) => {
    expect(LollipopSignatureSchema.safeParse(value).success).toBe(true);
  });

  it.each`
    scenario                                    | input
    ${"rejects empty string"}                   | ${""}
    ${"rejects label without colon delimiters"} | ${"sig1=AAAA"}
    ${"rejects label with wrong prefix"}        | ${"key1=:AAAA=:"}
    ${"rejects invalid base64 chars in value"}  | ${"sig1=:!!!:"}
    ${"rejects label without = separator"}      | ${"sig1:AAAA=:"}
  `("$scenario", ({ input }) => {
    expect(LollipopSignatureSchema.safeParse(input).success).toBe(false);
  });
});
