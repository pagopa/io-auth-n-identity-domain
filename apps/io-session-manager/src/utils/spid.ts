import * as O from "fp-ts/lib/Option";
import * as t from "io-ts";
import * as S from "fp-ts/lib/string";
import * as A from "fp-ts/lib/Array";
import { FiscalCode, NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { flow, pipe } from "fp-ts/lib/function";
import { safeXMLParseFromString } from "@pagopa/io-spid-commons/dist/utils/samlUtils";
import { UserWithoutTokens } from "../types/user";
import { SpidLevel, SpidLevelEnum } from "../types/spid-level";
import { EmailAddress } from "../generated/backend/EmailAddress";
import { formatDate } from "./date";

const SAML_NAMESPACE = {
  ASSERTION: "urn:oasis:names:tc:SAML:2.0:assertion",
  PROTOCOL: "urn:oasis:names:tc:SAML:2.0:protocol",
};

export const getIssuerFromSAMLResponse: (
  doc: Document,
) => O.Option<NonEmptyString> = flow(
  (doc) =>
    doc.getElementsByTagNameNS(SAML_NAMESPACE.ASSERTION, "Issuer").item(0),
  O.fromNullable,
  O.chainNullableK((element) => element.textContent?.trim()),
  O.chain((value) => O.fromEither(NonEmptyString.decode(value))),
);

export const getSpidLevelFromSAMLResponse: (
  doc: Document,
) => O.Option<SpidLevelEnum> = flow(
  (doc) =>
    doc
      .getElementsByTagNameNS(SAML_NAMESPACE.ASSERTION, "AuthnContextClassRef")
      .item(0),
  O.fromNullable,
  O.chainNullableK((element) => element.textContent?.trim()),
  O.chain((value) => O.fromEither(SpidLevel.decode(value))),
);

export const getUserAttributeFromAssertion =
  (attrName: string) =>
  (SAMLResponse: Document): O.Option<NonEmptyString> =>
    pipe(
      Array.from(
        SAMLResponse.getElementsByTagNameNS(
          SAML_NAMESPACE.ASSERTION,
          "Attribute",
        ),
      ),
      A.findFirst((element) => element.getAttribute("Name") === attrName),
      O.chainNullableK((element) => element.textContent?.trim()),
      O.chain((value) => O.fromEither(NonEmptyString.decode(value))),
    );

export const getFiscalNumberFromPayload: (
  doc: Document,
) => O.Option<FiscalCode> = flow(
  getUserAttributeFromAssertion("fiscalNumber"),
  O.map(S.toUpperCase),
  O.map((fiscalCode) =>
    // Remove the international prefix from fiscal code.
    fiscalCode.replace("TINIT-", ""),
  ),
  O.chain((nationalFiscalCode) =>
    O.fromEither(FiscalCode.decode(nationalFiscalCode)),
  ),
);

export const getDateOfBirthFromAssertion: (
  doc: Document,
) => O.Option<NonEmptyString> = getUserAttributeFromAssertion("dateOfBirth");

export const getFamilyNameFromAssertion: (
  doc: Document,
) => O.Option<NonEmptyString> = getUserAttributeFromAssertion("familyName");

export const getNameFromAssertion: (doc: Document) => O.Option<NonEmptyString> =
  getUserAttributeFromAssertion("name");

export const getSpidEmailFromAssertion: (
  doc: Document,
) => O.Option<EmailAddress> = flow(
  getUserAttributeFromAssertion("email"),
  O.chain((value) => O.fromEither(EmailAddress.decode(value))),
);

export const makeProxyUserFromSAMLResponse = (
  doc: Document,
): t.Validation<UserWithoutTokens> => {
  const proxyUserProperties = {
    created_at: new Date().getTime(),
    date_of_birth: pipe(
      getDateOfBirthFromAssertion(doc),
      O.map(formatDate),
      O.toUndefined,
    ),
    family_name: pipe(getFamilyNameFromAssertion(doc), O.toUndefined),
    fiscal_code: pipe(getFiscalNumberFromPayload(doc), O.toUndefined),
    name: pipe(getNameFromAssertion(doc), O.toUndefined),
    spid_email: pipe(getSpidEmailFromAssertion(doc), O.toUndefined),
    spid_idp: pipe(getIssuerFromSAMLResponse(doc), O.toUndefined),
    spid_level: pipe(
      getSpidLevelFromSAMLResponse(doc),
      O.getOrElse(() => SpidLevelEnum["https://www.spid.gov.it/SpidL2"] as SpidLevelEnum),
    ),
  };
  return pipe(proxyUserProperties, UserWithoutTokens.decode);
};

const getRequestIDFromPayload =
  (tagName: string, attrName: string) =>
  (doc: Document): O.Option<string> =>
    pipe(
      O.fromNullable(
        doc.getElementsByTagNameNS(SAML_NAMESPACE.PROTOCOL, tagName).item(0),
      ),
      O.chain((element) =>
        O.fromEither(NonEmptyString.decode(element.getAttribute(attrName))),
      ),
    );

export const getRequestIDFromRequest = getRequestIDFromPayload(
  "AuthnRequest",
  "ID",
);

export const getRequestIDFromResponse = getRequestIDFromPayload(
  "Response",
  "InResponseTo",
);

/**
 * Extract AuthnContextClassRef from SAML response
 *
 * ie. for <saml2:AuthnContextClassRef>https://www.spid.gov.it/SpidL2</saml2:AuthnContextClassRef>
 * returns "https://www.spid.gov.it/SpidL2"
 */
export function getAuthnContextFromResponse(xml: string): O.Option<string> {
  return pipe(
    O.fromNullable(xml),
    O.chain(safeXMLParseFromString),
    O.chain(O.fromNullable),
    O.chain(getSpidLevelFromSAMLResponse),
  );
}
