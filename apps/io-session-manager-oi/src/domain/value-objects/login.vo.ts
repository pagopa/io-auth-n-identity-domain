import { FiscalCodeSchema, NonEmptyStringSchema } from "@pagopa/hexagonal-core";
import { LollipopAssertionRefSchema } from "@pagopa/io-auth-n-identity-domain";
import { LoginTypeSchema } from "@pagopa/io-auth-n-identity-session";
import { z } from "zod";

import { OidcConfigurationEnvSchema } from "./oidc.vo.js";

export const SpidAuthLevel = z.enum(["SpidL2", "SpidL3"]);

export type SpidAuthLevel = z.infer<typeof SpidAuthLevel>;

export const CurrentUserSchema = NonEmptyStringSchema.optional();

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
