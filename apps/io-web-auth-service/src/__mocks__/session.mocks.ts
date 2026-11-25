import {
  FiscalCodeSchema,
  NonEmptyStringSchema,
  type FiscalCode,
} from "@pagopa/hexagonal-core";

import type { OidcClaims } from "../domain/value-objects/oidc-claims.vo.js";

export const aFiscalCode: FiscalCode =
  FiscalCodeSchema.parse("AAAAAA00A00A000A");

export const aValidClaims: OidcClaims = {
  fiscalNumber: aFiscalCode,
  name: NonEmptyStringSchema.parse("Mario"),
  familyName: NonEmptyStringSchema.parse("Rossi"),
  acr: "https://www.spid.gov.it/SpidL2",
  iss: NonEmptyStringSchema.parse("https://uat.oneid.pagopa.it"),
  idpEntityId: NonEmptyStringSchema.parse("https://idp.example.com"),
};
