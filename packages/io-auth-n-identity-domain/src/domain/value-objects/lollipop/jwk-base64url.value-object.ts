import { z } from "zod";

const hasKtyField = (json: unknown): boolean => {
  return (
    typeof json === "object" &&
    json !== null &&
    typeof (json as Record<string, unknown>).kty === "string"
  );
};

export const JwkBase64UrlSchema = z
  .string()
  .min(1)
  .regex(/^[A-Za-z0-9_-]+=*$/, {
    message: "Invalid Base64url-encoded JWK",
  })
  .refine(
    (val) => {
      try {
        return hasKtyField(
          JSON.parse(Buffer.from(val, "base64url").toString("utf-8")),
        );
      } catch {
        return false;
      }
    },
    { message: "Must be a Base64url-encoded JWK with a valid 'kty' field" },
  )
  .describe("Base64url-encoded JWK")
  .brand<"JwkBase64Url">();

export type JwkBase64Url = z.infer<typeof JwkBase64UrlSchema>;
