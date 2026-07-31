import { z } from "zod";

export const OidcConfigurationEnvSchema = z.union([
  z.literal("UAT"),
  z.literal("PROD"),
]);
export type OidcConfigurationEnv = z.infer<typeof OidcConfigurationEnvSchema>;
