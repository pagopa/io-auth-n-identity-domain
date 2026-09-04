import { z } from "zod";

export const OidcConfigurationEnvSchema = z.enum(["UAT", "PROD"]);
export type OidcConfigurationEnv = z.infer<typeof OidcConfigurationEnvSchema>;
