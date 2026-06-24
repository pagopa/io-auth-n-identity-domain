import { z } from "zod";

/**
 * Signature header value.
 * Format: one or more comma-separated `sig<N>=:<BASE64>:` entries, e.g.
 * `sig1=:BASE64ENCODED:` or `sig1=:BASE64:, sig2=:BASE64:`
 */
export const LollipopSignatureSchema = z
  .string()
  .regex(
    /^((sig[0-9]+)=:[A-Za-z0-9+/=]*:(, ?)?)+$/,
    "Invalid signature format. Expected one or more sig<N>=:<BASE64>: entries.",
  )
  .describe(
    "Signature header value. Format: one or more comma-separated sig<N>=:<BASE64>: entries, e.g. `sig1=:BASE64ENCODED:` or `sig1=:BASE64:, sig2=:BASE64:`",
  )
  .brand<"LollipopSignature">();

export type LollipopSignature = z.infer<typeof LollipopSignatureSchema>;
