import { z } from "zod";

import { Base64UrlJsonSchema } from "../common/base64url-string.vo.js";

export const EcKeySchema = z.object({
  crv: z.enum(["P-256", "P-384", "P-521"]),
  kty: z.literal("EC"),
  x: z.string(),
  y: z.string(),
});

export const RsaKeySchema = z.object({
  alg: z.string(),
  e: z.string(),
  kty: z.literal("RSA"),
  n: z.string(),
});

export const JwkPublicKeySchema = z.discriminatedUnion("kty", [
  EcKeySchema,
  RsaKeySchema,
]);

export type JwkPublicKey = z.infer<typeof JwkPublicKeySchema>;

/**
 * Schema for a JWK public key encoded as a Base64Url string.
 * This schema can be used to validate and parse JWK public keys that are encoded as Base64Url strings.
 * The resulting parsed object will conform to the `JwkPublicKeySchema`.
 *
 * Example usage:
 * ```ts
 * const parsedKey: JwkPublicKey = JwkPublicKeyBase64UrlStringSchema.parse(base64UrlEncodedKey);
 * const encodedKey: string = JwkPublicKeyBase64UrlStringSchema.encode(parsedKey);
 * ```
 */
export const JwkPublicKeyBase64UrlStringSchema =
  Base64UrlJsonSchema.pipe(JwkPublicKeySchema);
