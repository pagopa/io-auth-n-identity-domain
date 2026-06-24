import { z } from "zod";

export const AssertionRefSha256Schema = z
  .string()
  .regex(
    /^(sha256-[A-Za-z0-9-_=]{1,44})$/,
    "Invalid AssertionRef: expected sha256-<base64url>",
  )
  .describe("Assertion reference, e.g. `sha256-<thumbprint>`")
  .brand<"AssertionRefSha256">();

export type AssertionRefSha256 = z.infer<typeof AssertionRefSha256Schema>;

export const AssertionRefSha384Schema = z
  .string()
  .regex(
    /^(sha384-[A-Za-z0-9-_=]{1,64})$/,
    "Invalid AssertionRef: expected sha384-<base64url>",
  )
  .describe("Assertion reference, e.g. `sha384-<thumbprint>`")
  .brand<"AssertionRefSha384">();

export type AssertionRefSha384 = z.infer<typeof AssertionRefSha384Schema>;

export const AssertionRefSha512Schema = z
  .string()
  .regex(
    /^(sha512-[A-Za-z0-9-_=]{1,88})$/,
    "Invalid AssertionRef: expected sha512-<base64url>",
  )
  .describe("Assertion reference, e.g. `sha512-<thumbprint>`")
  .brand<"AssertionRefSha512">();

export type AssertionRefSha512 = z.infer<typeof AssertionRefSha512Schema>;

export const LollipopAssertionRefSchema = z
  .union([
    AssertionRefSha256Schema,
    AssertionRefSha384Schema,
    AssertionRefSha512Schema,
  ])
  .describe(
    "Assertion reference, e.g. `sha256-<thumbprint>` or `sha384-<thumbprint>` or `sha512-<thumbprint>`",
  )
  .brand<"LollipopAssertionRef">();

export type LollipopAssertionRef = z.infer<typeof LollipopAssertionRefSchema>;
