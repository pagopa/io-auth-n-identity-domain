import { z } from "zod";

/**
 * Signature-Input header value.
 * Format: one or more comma-separated signature labels, e.g.
 * `sig1=("@method" "@path");nonce="abc"` or
 * `sig1=("@method");created=1618884475, sig2=("@authority")`
 */
export const LollipopSignatureInputSchema = z
  .string()
  .regex(
    /^(?:sig\d+=[^,]*)(?:,\s*(?:sig\d+=[^,]*))*$/,
    "Invalid signature-input format. Expected one or more comma-separated sig<N>=<params> entries.",
  )
  .describe(
    "Signature-Input header value. Format: one or more comma-separated signature labels, e.g. `sig1=('@method' '@path');nonce='abc'` or `sig1=('@method');created=1618884475, sig2=('@authority')`",
  )
  .brand<"LollipopSignatureInput">();

export type LollipopSignatureInput = z.infer<
  typeof LollipopSignatureInputSchema
>;
