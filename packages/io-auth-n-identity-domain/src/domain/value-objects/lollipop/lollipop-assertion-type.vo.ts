import { z } from "zod";

export const AssertionTypeSchema = z.enum(["SAML", "OIDC"]);
export type AssertionTypeSchema = z.infer<typeof AssertionTypeSchema>;
