import { z } from "zod";

/**
 * Content-Digest header value as defined in RFC 9530.
 * Format: `<algorithm>=:<base64-digest>:`
 *
 * Supported algorithms and their base64 output lengths:
 * - sha-256: 32 bytes → 44 base64 chars
 * - sha-384: 48 bytes → 64 base64 chars
 * - sha-512: 64 bytes → 88 base64 chars
 */
export const LollipopContentDigestSchema = z
  .string()
  .regex(
    /^(sha-256=:[A-Za-z0-9+/=]{44}:|sha-384=:[A-Za-z0-9+/=]{64}:|sha-512=:[A-Za-z0-9+/=]{88}:)$/,
    "Invalid content-digest format. Expected sha-256=:BASE64:, sha-384=:BASE64:, or sha-512=:BASE64:",
  )
  .describe(
    "Content-Digest header value as defined in RFC 9530. Format: `<algorithm>=:<base64-digest>:`",
  )
  .brand<"LollipopContentDigest">();

export type LollipopContentDigest = z.infer<typeof LollipopContentDigestSchema>;
