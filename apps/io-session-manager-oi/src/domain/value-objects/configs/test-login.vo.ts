import { gunzipSync } from "node:zlib";

import {
  FiscalCodeBrand,
  FiscalCodeSchema,
  NonEmptyStringSchema,
} from "@pagopa/hexagonal-core";
import { z } from "zod";

// This is a temporary workaround to ensure that the branded types are included in the type system.
const _brands = [FiscalCodeBrand];

// Gzipped (then base64-encoded) comma-separated list of test users' fiscal codes
export const CompressedFiscalCodeSet = z
  .string()
  .transform((raw, ctx) => {
    if (raw.trim() === "") {
      return [];
    }
    try {
      return gunzipSync(Buffer.from(raw, "base64"))
        .toString()
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
    } catch {
      ctx.addIssue({
        code: "custom",
        message: "Invalid compressed FiscalCode list value",
      });
      return z.NEVER;
    }
  })
  .pipe(z.array(FiscalCodeSchema))
  .transform((codes) => new Set(codes));

export const TestLoginConfigSchema = z.object({
  // Fiscal codes of test users; profiles created for them are flagged as test profiles
  TEST_LOGIN_FISCAL_CODES_COMPRESSED: CompressedFiscalCodeSet,
  TEST_LOGIN_PASSWORD: NonEmptyStringSchema,
});

export type TestLoginConfig = z.infer<typeof TestLoginConfigSchema>;
