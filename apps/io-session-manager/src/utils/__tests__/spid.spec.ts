import { test, describe, expect } from "vitest";
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
  getSpidLevelFromSAMLResponse,
} from "../spid";
import { aFiscalCode } from "../../__mocks__/user.mocks";

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
