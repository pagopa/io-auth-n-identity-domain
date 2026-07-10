import { z } from "zod";

export enum AssertionTypeEnum {
  "SAML" = "SAML",
  "OIDC" = "OIDC",
}
export const AssertionTypeSchema = z.enum(AssertionTypeEnum);
export type AssertionTypeSchema = z.infer<typeof AssertionTypeSchema>;
