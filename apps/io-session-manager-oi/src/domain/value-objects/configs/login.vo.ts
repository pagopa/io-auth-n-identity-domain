import { gunzipSync } from "node:zlib";

import { FiscalCodeBrand, FiscalCodeSchema } from "@pagopa/hexagonal-core";
import { z } from "zod";

// This is a temporary workaround to ensure that the branded types are included in the type system.
const _brands = [FiscalCodeBrand];

// Gzipped (then base64-encoded) comma-separated list of test users' fiscal codes
const CompressedFiscalCodeSet = z
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

/**
 * Login configuration schema.
 * `LOGIN_SUCCESS_REDIRECT_URL` is the base URL the callback endpoint redirects
 * the user-agent to once the session has been activated. The freshly minted
 * client session token is appended to it.
 * `LOGIN_ERROR_REDIRECT_URL` is the base URL the callback endpoint redirects
 * the user-agent to when the login fails. The error code (and optional message)
 * is appended to it as query parameters.
 */
export const LoginConfigSchema = z.object({
  LOGIN_SUCCESS_REDIRECT_URL: z.url(),
  LOGIN_ERROR_REDIRECT_URL: z.url(),

  // Fiscal codes of test users; profiles created for them are flagged as test profiles
  TEST_LOGIN_FISCAL_CODES_COMPRESSED: CompressedFiscalCodeSet.default(
    new Set(),
  ),

  // Timeout (seconds) applied to every HTTP request towards the OIDC provider
  // (discovery, JWKS, token endpoint). Prevents slow upstream responses from
  // exhausting connections under load.
  ONEID_HTTP_TIMEOUT_SECONDS: z.coerce.number().int().positive().default(8),
});

export type LoginConfig = z.infer<typeof LoginConfigSchema>;
