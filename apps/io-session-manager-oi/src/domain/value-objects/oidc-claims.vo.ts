import {
  EmailAddressSchema,
  FiscalCodeSchema,
  NonEmptyStringSchema,
} from "@pagopa/hexagonal-core";
import { SpidLevelSchema } from "@pagopa/io-auth-n-identity-session";
import { z } from "zod";

// International prefix for fiscal numbers that should be stripped before validation.
const FISCAL_NUMBER_INTERNATIONAL_PREFIX = "TINIT-";

/**
 * Subset of the OpenID Connect ID token claims returned by OneID that the
 * session domain needs to build a new user session.
 *
 * The schema is intentionally permissive on unknown claims (they are stripped)
 * while validating the fields consumed downstream.
 */
export const OidcClaimsSchema = z.object({
  fiscalNumber: z
    .string()
    .transform((value) => value.replace(FISCAL_NUMBER_INTERNATIONAL_PREFIX, ""))
    .pipe(FiscalCodeSchema),
  name: NonEmptyStringSchema,
  familyName: NonEmptyStringSchema,
  email: EmailAddressSchema.optional(),
  dateOfBirth: z.coerce.date(),
  // `acr` carries the SPID authentication level as its canonical URL.
  acr: SpidLevelSchema,
  // `iss` is the OneID issuer, used as the identity provider reference.
  iss: NonEmptyStringSchema,
});

export type OidcClaims = z.infer<typeof OidcClaimsSchema>;
