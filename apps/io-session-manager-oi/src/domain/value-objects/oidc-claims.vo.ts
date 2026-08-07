import {
  EmailAddressSchema,
  FiscalCodeSchema,
  NonEmptyStringSchema,
} from "@pagopa/hexagonal-core";
import { SpidLevelSchema } from "@pagopa/io-auth-n-identity-session/value-objects";
import { z } from "zod";

/**
 * Subset of the OpenID Connect ID token claims returned by OneID that the
 * session domain needs to build a new user session.
 *
 * The schema is intentionally permissive on unknown claims (they are stripped)
 * while validating the fields consumed downstream.
 */
export const OidcClaimsSchema = z.object({
  fiscalNumber: FiscalCodeSchema,
  name: NonEmptyStringSchema,
  familyName: NonEmptyStringSchema,
  // `acr` carries the SPID authentication level as its canonical URL.
  acr: SpidLevelSchema,
  email: EmailAddressSchema.optional(),
  // `iss` is the OneID issuer, used as the identity provider reference.
  iss: NonEmptyStringSchema,

  // TODO: add dateOfBirth
});

export type OidcClaims = z.infer<typeof OidcClaimsSchema>;
