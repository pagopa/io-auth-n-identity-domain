import { z } from "zod";

/**
 * Lollipop assertion reference: a `{algo}-{base64url-thumbprint}` string
 * that uniquely identifies a reserved public key.
 */
export const LollipopAssertionRefSchema = z
  .string()
  .regex(
    /^(sha256-[A-Za-z0-9-_=]{1,44}|sha384-[A-Za-z0-9-_=]{1,66}|sha512-[A-Za-z0-9-_=]{1,88})$/,
    { message: "Invalid assertion ref format" },
  )
  .describe("Lollipop assertion reference (algo-thumbprint)")
  .brand<"LollipopAssertionRef">();

export type LollipopAssertionRef = z.infer<typeof LollipopAssertionRefSchema>;
