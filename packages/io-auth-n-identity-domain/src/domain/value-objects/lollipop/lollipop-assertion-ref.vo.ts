import { z } from "zod";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export declare const BrandLollipopAssertionRef: unique symbol;

const assertionRefSchema = (algorithm: "sha256" | "sha384" | "sha512") =>
  z.string().refine((value) => {
    const prefix = `${algorithm}-`;
    if (!value.startsWith(prefix)) {
      return false;
    }
    return z
      .hash(algorithm, { enc: "base64url" })
      .safeParse(value.slice(prefix.length)).success;
  }, `Invalid ${algorithm} assertion ref format`);

/**
 * Lollipop assertion reference: a `{algo}-{base64url-thumbprint}` string
 * that uniquely identifies a reserved public key.
 */
export const LollipopAssertionRefSchema = z
  .union(
    [
      assertionRefSchema("sha256"),
      assertionRefSchema("sha384"),
      assertionRefSchema("sha512"),
    ],
    "Invalid assertion ref format",
  )
  .brand<typeof BrandLollipopAssertionRef>();

export type LollipopAssertionRef = z.infer<typeof LollipopAssertionRefSchema>;
