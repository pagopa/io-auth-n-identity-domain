import { describe, expect, it } from "vitest";

import {
  aDateOfBirth,
  aFamilyName,
  aFiscalCode,
  aName,
  anEmailAddress,
  aSpidLevel,
} from "../../../__mocks__/session.mocks.js";
import { OidcClaimsSchema } from "../oidc-claims.vo.js";

const anIssuer = "https://uat.io.oneid.pagopa.it";

const aValidClaims = {
  fiscalNumber: aFiscalCode,
  name: aName,
  familyName: aFamilyName,
  email: anEmailAddress,
  dateOfBirth: aDateOfBirth,
  acr: aSpidLevel,
  iss: anIssuer,
};

describe("OidcClaimsSchema", () => {
  it("accepts a bare national fiscal code unchanged", () => {
    const parsed = OidcClaimsSchema.parse(aValidClaims);

    expect(parsed.fiscalNumber).toBe(aFiscalCode);
  });

  it("strips a leading TINIT- prefix from fiscalNumber", () => {
    const prefix = "TINIT-";
    const parsed = OidcClaimsSchema.parse({
      ...aValidClaims,
      fiscalNumber: `${prefix}${aFiscalCode}`,
    });

    expect(parsed.fiscalNumber).toBe(aFiscalCode);
  });

  it.each([
    "not-a-fiscal-code",
    "TINAT-ISPXNB32R82Y766D",
    `XX${aFiscalCode}`,
    "TINIT-",
    "tinit-",
  ])("rejects fiscalNumber %j", (fiscalNumber) => {
    expect(
      OidcClaimsSchema.safeParse({ ...aValidClaims, fiscalNumber }).success,
    ).toBe(false);
  });
});
