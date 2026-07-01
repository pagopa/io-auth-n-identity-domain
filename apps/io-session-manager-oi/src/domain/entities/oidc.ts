import { z } from "zod";

export const OidcConfigurationEnv = z.union([
  z.literal("UAT"),
  z.literal("PROD"),
]);
export type OidcConfigurationEnv = z.infer<typeof OidcConfigurationEnv>;
