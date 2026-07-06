import { NonEmptyStringSchema } from "@pagopa/hexagonal-core";
import { z } from "zod";

/**
 * A non-empty Base64url-encoded string (RFC 4648 §5, unpadded).
 */
export const Base64UrlStringSchema = NonEmptyStringSchema.regex(
  /^[A-Za-z0-9_-]+$/,
  { message: "Invalid Base64url string" },
);

export type Base64UrlString = z.infer<typeof Base64UrlStringSchema>;

/**
 * Base64url-encoded JSON payload.
 *
 * Decodes the input from Base64url and JSON.parses it, emitting the parsed
 * value as `unknown`. Compose with another Zod schema via `.pipe()` to
 * validate the decoded shape.
 */
export const Base64UrlJsonSchema = Base64UrlStringSchema.transform(
  (val, ctx) => {
    try {
      return JSON.parse(
        Buffer.from(val, "base64url").toString("utf-8"),
      ) as unknown;
    } catch {
      ctx.addIssue({
        code: "custom",
        message: "Invalid Base64url-encoded JSON",
      });
      return z.NEVER;
    }
  },
);
