import { z } from "zod";

export const AssertionType = z
  .enum(["SAML", "OIDC"])
  .describe("Assertion type, e.g. 'SAML' or 'OIDC'")
  .brand<"AssertionType">();

export type AssertionType = z.infer<typeof AssertionType>;
