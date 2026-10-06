import { describe, expect, it } from "vitest";

import {
  aDateOfBirth,
  aFamilyName,
  aFiscalCode,
  aName,
  anEmailAddress,
  aSpidLevel,
} from "../../../__mocks__/session.mocks.js";
import { OidcAuthTokensSchema, OidcEnvironmentSchema } from "../oidc.vo.js";

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

describe("OidcEnvironmentSchema", () => {
  it.each(["UAT", "PROD"])("accepts %s", (environment) => {
    expect(OidcEnvironmentSchema.parse(environment)).toBe(environment);
  });

  it("rejects unsupported environments", () => {
    expect(OidcEnvironmentSchema.safeParse("DEV").success).toBe(false);
  });
});

describe("OidcAuthTokensSchema", () => {
  it("accepts claims and an access token", () => {
    const parsed = OidcAuthTokensSchema.parse({
      claims: aValidClaims,
      accessToken: "an-access-token",
    });

    expect(parsed.claims).toEqual(aValidClaims);
    expect(parsed.accessToken).toBe("an-access-token");
  });

  it("rejects an empty access token", () => {
    const result = OidcAuthTokensSchema.safeParse({
      claims: aValidClaims,
      accessToken: "",
    });

    expect(result.success).toBe(false);
  });
});
