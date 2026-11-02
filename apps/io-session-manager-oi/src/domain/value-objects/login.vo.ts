import { NonEmptyStringSchema } from "@pagopa/hexagonal-core";
import { LollipopAssertionRefSchema } from "@pagopa/io-auth-n-identity-domain";
import {
  LoginTypeSchema,
  Sha256HexStringSchema,
} from "@pagopa/io-auth-n-identity-session";
import { z } from "zod";

import { OidcEnvironmentSchema } from "./oidc.vo.js";

export const SpidAuthLevel = z.enum(["SpidL2", "SpidL3"]);

export type SpidAuthLevel = z.infer<typeof SpidAuthLevel>;

export const CurrentUserSchema = Sha256HexStringSchema.optional();

export type CurrentUser = z.infer<typeof CurrentUserSchema>;

export const LoginAuxiliaryDataSchema = z.object({
  loginType: LoginTypeSchema,
  currentUser: CurrentUserSchema,
  lollipopAssertionRef: LollipopAssertionRefSchema,
  clientId: NonEmptyStringSchema,
  minAuthLevel: SpidAuthLevel,
  oidcConfigurationEnv: OidcEnvironmentSchema,
  nonce: NonEmptyStringSchema,
});

export type LoginAuxiliaryData = z.infer<typeof LoginAuxiliaryDataSchema>;
