import { test, describe, expect } from "vitest";
import { IDP_NAMES, Issuer } from "@pagopa/io-spid-commons/dist/config";
import { safeXMLParseFromString } from "@pagopa/io-spid-commons/dist/utils/samlUtils";
import * as O from "fp-ts/Option";
import {
  aSAMLRequest,
  aSamlRequestId,
  getASAMLResponse,
} from "../../__mocks__/spid.mocks";
import {
  getDateOfBirthFromAssertion,
  getFamilyNameFromAssertion,
  getFiscalNumberFromPayload,
  getIssuerFromSAMLResponse,
  getNameFromAssertion,
  getRequestIDFromRequest,
  getRequestIDFromResponse,
  getSpidEmailFromAssertion,
  getSpidIdpFriendlyName,
  getSpidLevelFromSAMLResponse,
  isSpidLevelGreaterOrEqual,
  isWellFormedSAMLAssertion,
} from "../spid";
import { aFiscalCode } from "../../__mocks__/user.mocks";
import { SpidLevelEnum } from "../../types/spid-level";
import { SpidAuthLevelEnum } from "../../generated/backend/SpidAuthLevel";

const aDOMSamlRequest = O.getOrElseW(() => {
  throw new Error("Invalid mock");
})(safeXMLParseFromString(aSAMLRequest));
const aDOMSamlResponse = O.getOrElseW(() => {
  throw new Error("Invalid mock");
})(safeXMLParseFromString(getASAMLResponse()));

describe("SPID logs", () => {
  test("should get SPID request id from request", () => {
    const requestId = getRequestIDFromRequest(aDOMSamlRequest);
    expect(requestId).toEqual(O.some("A-REQUEST-ID"));
  });
  test("should get SPID request id from response", () => {
    const requestId = getRequestIDFromResponse(aDOMSamlResponse);
    expect(requestId).toEqual(O.some(aSamlRequestId));
  });

  test("should get SPID user's fiscal code from response", () => {
    const fiscalCode = getFiscalNumberFromPayload(aDOMSamlResponse);
    expect(fiscalCode).toEqual(O.some(aFiscalCode));
  });

  test("should get SPID issuer from response", () => {
    const issuer = getIssuerFromSAMLResponse(aDOMSamlResponse);
    expect(issuer).toEqual(O.some("http://localhost:8080"));
  });

  test("should get SPID Level from response", () => {
    const SPIDLevel = getSpidLevelFromSAMLResponse(aDOMSamlResponse);
    expect(SPIDLevel).toEqual(O.some("https://www.spid.gov.it/SpidL2"));
  });

  test("should get SPID user's date of birth from response", () => {
    const dateOfBirth = getDateOfBirthFromAssertion(aDOMSamlResponse);
    expect(dateOfBirth).toEqual(O.some("1970-01-01"));
  });

  test("should get SPID user's first name from response", () => {
    const firstName = getNameFromAssertion(aDOMSamlResponse);
    expect(firstName).toEqual(O.some("SpidValidator"));
  });

  test("should get SPID user's family name from response", () => {
    const familyName = getFamilyNameFromAssertion(aDOMSamlResponse);
    expect(familyName).toEqual(O.some("AgID"));
  });

  test("should get SPID user's email from response", () => {
    const spidEmail = getSpidEmailFromAssertion(aDOMSamlResponse);
    expect(spidEmail).toEqual(O.some("spid.tech@agid.gov.it"));
  });
});

describe("getSpidIdpFriendlyName", () => {
  const aKnownIssuer = Object.keys(IDP_NAMES)[0] as Issuer;

  test("should return the mapped IDP name for a known issuer", async () => {
    expect(await getSpidIdpFriendlyName(aKnownIssuer)).toEqual(
      IDP_NAMES[aKnownIssuer],
    );
  });

  test("should return Sconosciuto for an unknown issuer", async () => {
    expect(await getSpidIdpFriendlyName("https://unknown.idp.example")).toEqual(
      "Sconosciuto",
    );
  });
});

describe("isWellFormedSAMLAssertion", () => {
  test("should return true for a well formed SAML response", () => {
    expect(isWellFormedSAMLAssertion(aDOMSamlResponse)).toEqual(true);
  });

  test("should return false for a tampered SAML response with trailing content", () => {
    const tamperedResponse = O.getOrElseW(() => {
      throw new Error("Invalid mock");
    })(
      safeXMLParseFromString(`${getASAMLResponse()}<injected>evil</injected>`),
    );

    expect(isWellFormedSAMLAssertion(tamperedResponse)).toEqual(false);
  });
});

describe("isSpidLevelGreaterOrEqual", () => {
  const spidL1 = SpidLevelEnum["https://www.spid.gov.it/SpidL1"];
  const spidL2 = SpidLevelEnum["https://www.spid.gov.it/SpidL2"];
  const spidL3 = SpidLevelEnum["https://www.spid.gov.it/SpidL3"];

  // NOTE: starting from SpidL2 comparison because its the minimum supported
  test.each`
    spidLevelReceived | minAuthLevel                | expected
    ${spidL2}         | ${SpidAuthLevelEnum.SpidL2} | ${true}
    ${spidL3}         | ${SpidAuthLevelEnum.SpidL2} | ${true}
    ${spidL1}         | ${SpidAuthLevelEnum.SpidL2} | ${false}
    ${spidL2}         | ${SpidAuthLevelEnum.SpidL3} | ${false}
    ${spidL3}         | ${SpidAuthLevelEnum.SpidL3} | ${true}
  `(
    "should return $expected when spidLevelReceived is $spidLevelReceived and minAuthLevel is $minAuthLevel",
    ({ spidLevelReceived, minAuthLevel, expected }) => {
      expect(
        isSpidLevelGreaterOrEqual(spidLevelReceived, minAuthLevel),
      ).toEqual(expected);
    },
  );
});
