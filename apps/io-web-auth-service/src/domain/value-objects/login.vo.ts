import { NonEmptyStringSchema } from "@pagopa/hexagonal-core";
import { z } from "zod";

import { OidcEnvironmentSchema } from "./oidc.vo.js";

export const SpidAuthLevel = z.enum(["SpidL1", "SpidL2", "SpidL3"]);

export type SpidAuthLevel = z.infer<typeof SpidAuthLevel>;

export type SpidLevel = `https://www.spid.gov.it/${SpidAuthLevel}`;

/** Identity provider the user wants to log in with, forwarded to OneIdentity. */
export const IdpSchema = NonEmptyStringSchema;

export type Idp = z.infer<typeof IdpSchema>;

export const LoginAuxiliaryDataSchema = z.object({
  clientId: NonEmptyStringSchema,
  minAuthLevel: SpidAuthLevel,
  oidcConfigurationEnv: OidcEnvironmentSchema,
  nonce: NonEmptyStringSchema,
});

export type LoginAuxiliaryData = z.infer<typeof LoginAuxiliaryDataSchema>;
