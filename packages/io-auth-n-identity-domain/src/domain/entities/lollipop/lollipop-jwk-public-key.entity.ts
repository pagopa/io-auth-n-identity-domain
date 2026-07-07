import { z } from "zod";

import { Base64UrlJsonSchema } from "../../value-objects/common/base64url-string.value-object.js";

export const EcKeySchema = z.object({
  alg: z.string(),
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

export const JwkPublicKeyBase64UrlStringSchema =
  Base64UrlJsonSchema.pipe(JwkPublicKeySchema);

export type JwkPublicKeyBase64UrlString = z.infer<
  typeof JwkPublicKeyBase64UrlStringSchema
>;
