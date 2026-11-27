import { FiscalCodeSchema, NonEmptyStringSchema } from "@pagopa/hexagonal-core";
import { z } from "zod";

import { SpidLevelSchema } from "./login.vo.js";

// International prefix for fiscal numbers that should be stripped before validation.
const FISCAL_NUMBER_INTERNATIONAL_PREFIX = /^TINIT-/;

/**
 * OneID ID token claims retained by the web callback. Other claims are stripped.
 */
export const OidcClaimsSchema = z.object({
  fiscalNumber: z
    .string()
    .transform((value) => value.replace(FISCAL_NUMBER_INTERNATIONAL_PREFIX, ""))
    .pipe(FiscalCodeSchema),
  name: NonEmptyStringSchema,
  familyName: NonEmptyStringSchema,
  // `acr` carries the SPID authentication level as its canonical URL.
  acr: SpidLevelSchema,
  // `iss` identifies OneID; `idpEntityId` identifies the SPID identity provider.
  iss: NonEmptyStringSchema,
  idpEntityId: NonEmptyStringSchema,
});

export type OidcClaims = z.infer<typeof OidcClaimsSchema>;
