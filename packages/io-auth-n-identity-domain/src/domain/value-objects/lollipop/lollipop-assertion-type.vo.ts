import { z } from "zod";

export const LollipopAssertionTypeSchema = z.enum(["SAML", "OIDC"]);
export type LollipopAssertionType = z.infer<typeof LollipopAssertionTypeSchema>;
