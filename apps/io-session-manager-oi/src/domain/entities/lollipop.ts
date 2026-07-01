import { z } from "zod";

export const ECKey = z
  .object({
    crv: z.string(),
    kty: z.literal("EC"),
    x: z.string(),
    y: z.string(),
  })
  .strict();

export const RSAKey = z
  .object({
    alg: z.string(),
    e: z.string(),
    kty: z.literal("RSA"),
    n: z.string(),
  })
  .strict();

export const JwkPublicKey = z.discriminatedUnion("kty", [RSAKey, ECKey]);

export type JwkPublicKey = z.infer<typeof JwkPublicKey>;

export const JwkPublicKeyString = z
  .string()
  .transform((str, ctx) => {
    try {
      const decodedStr = Buffer.from(str, "base64").toString();

      return JSON.parse(decodedStr);
    } catch (e) {
      ctx.addIssue({
        code: "custom",
        message: "Impossibile decodificare la stringa Base64 o JSON non valido",
      });
      return z.NEVER;
    }
  })
  .pipe(JwkPublicKey);

export type JwkPublicKeyString = z.infer<typeof JwkPublicKeyString>;

export const LollipopAssertionRef = z.string().brand("LollipopAssertionRef");
export type LollipopAssertionRef = z.infer<typeof LollipopAssertionRef>;

export const LollipopHashAlgorithm = z
  .union([z.literal("sha256"), z.literal("sha384"), z.literal("sha512")])
  .default("sha256");
export type LollipopHashAlgorithm = z.infer<typeof LollipopHashAlgorithm>;
