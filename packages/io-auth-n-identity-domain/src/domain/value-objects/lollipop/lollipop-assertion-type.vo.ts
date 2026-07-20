import { z } from "zod";

export const LollipopAssertionTypeSchema = z.enum(["SAML", "OIDC"]);
export type LollipopAssertionTypeSchema = z.infer<
  typeof LollipopAssertionTypeSchema
>;
