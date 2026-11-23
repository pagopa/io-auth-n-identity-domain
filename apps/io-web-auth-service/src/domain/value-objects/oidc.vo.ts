import { z } from "zod";

export const OidcEnvironmentSchema = z.enum(["UAT", "PROD"]);
export type OidcEnvironment = z.infer<typeof OidcEnvironmentSchema>;
