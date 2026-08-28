import { NonEmptyStringSchema } from "@pagopa/hexagonal-core";
import { LollipopAssertionRefSchema } from "@pagopa/io-auth-n-identity-domain";
import { z } from "zod";

import { OidcConfigurationEnvSchema } from "./oidc.vo.js";

export const SpidAuthLevel = z.enum(["SpidL2", "SpidL3"]);

export type SpidAuthLevel = z.infer<typeof SpidAuthLevel>;

export const LoginTypeSchema = z.enum(["LV", "LEGACY"]).default("LEGACY");

export type LoginType = z.infer<typeof LoginTypeSchema>;

export const CurrentUserSchema = z
  .string()
  .brand("LoginCurrentUser")
  .optional();

export type CurrentUser = z.infer<typeof CurrentUserSchema>;

export const LoginAusiliarDataSchema = z.object({
  loginType: LoginTypeSchema,
  currentUser: CurrentUserSchema,
  lollipopAssertionRef: LollipopAssertionRefSchema,
  clientId: NonEmptyStringSchema,
  minAuthLevel: SpidAuthLevel,
  oidcConfigurationEnv: OidcConfigurationEnvSchema,
  nonce: NonEmptyStringSchema,
});

export type LoginAusiliarData = z.infer<typeof LoginAusiliarDataSchema>;
