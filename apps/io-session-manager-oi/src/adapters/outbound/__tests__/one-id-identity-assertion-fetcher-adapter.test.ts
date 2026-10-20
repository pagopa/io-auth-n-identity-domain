import {
  GenericError,
  type NonEmptyString,
  ValidationError,
} from "@pagopa/hexagonal-core";
import { beforeEach, describe, expect, it, vi } from "vitest";

const sdkMocks = vi.hoisted(() => ({
  createClient: vi.fn(() => ({})),
  getRequestHealthCheck: vi.fn(),
  getSamlAssertion: vi.fn(),
}));

vi.mock("../../../generated/one-identity/client/index.js", () => ({
  createClient: sdkMocks.createClient,
}));

vi.mock("../../../generated/one-identity/index.js", () => ({
  getRequestHealthCheck: sdkMocks.getRequestHealthCheck,
  getSamlAssertion: sdkMocks.getSamlAssertion,
}));

import { OneIdIdentityAssertionFetcherAdapter } from "../one-id-identity-assertion-fetcher-adapter.js";

const PROD_URL = new URL("https://oneid.example.com");
const UAT_URL = new URL("https://uat-oneid.example.com");
const ACCESS_TOKEN = "an-access-token" as NonEmptyString;
const ASSERTION_REF = `sha256-${"a".repeat(43)}`;
const FISCAL_CODE = "AAABBB01C02D345E";
const SUBJECT_XML = `<saml:Subject>
      <saml:SubjectConfirmation>
        <saml:SubjectConfirmationData InResponseTo="${ASSERTION_REF}" />
      </saml:SubjectConfirmation>
    </saml:Subject>`;
const FISCAL_ATTRIBUTE_XML = `<saml:Attribute Name="fiscalNumber"><saml:AttributeValue>TINIT-${FISCAL_CODE}</saml:AttributeValue></saml:Attribute>`;
const A_VALID_XML = `<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" InResponseTo="${ASSERTION_REF}">
  <saml:Assertion>
    ${SUBJECT_XML}
    <saml:AttributeStatement>
      ${FISCAL_ATTRIBUTE_XML}
    </saml:AttributeStatement>
  </saml:Assertion>
</samlp:Response>`;

const makeAdapter = (includeUat = true) =>
  new OneIdIdentityAssertionFetcherAdapter({
    ONEID_PROD_ISSUER: PROD_URL,
    ...(includeUat ? { ONEID_UAT_ISSUER: UAT_URL } : {}),
  });

const aResponse = (status: number, xml = A_VALID_XML) => ({
  response: { status },
  data: xml,
});

beforeEach(() => {
  vi.clearAllMocks();
  sdkMocks.getRequestHealthCheck.mockResolvedValue({
    response: { status: 200 },
    data: "ok",
  });
  sdkMocks.getSamlAssertion.mockResolvedValue(aResponse(200));
});

describe("OneIdIdentityAssertionFetcherAdapter#healthcheck", () => {
  it.each([200, 204, 299])(
    "accepts successful healthcheck status %s",
    async (status) => {
      sdkMocks.getRequestHealthCheck.mockResolvedValueOnce({
        response: { status },
        data: "ok",
      });
      const adapter = makeAdapter();

      const result = await adapter.healthcheck();

      expect(result.isOk()).toBe(true);
      expect(sdkMocks.getRequestHealthCheck).toHaveBeenCalledExactlyOnceWith({
        client: expect.anything(),
        parseAs: "text",
      });
    },
  );

  it.each([undefined, 199, 300, 503])(
    "returns an error for healthcheck status %s",
    async (status) => {
      sdkMocks.getRequestHealthCheck.mockResolvedValueOnce({
        response: status === undefined ? undefined : { status },
        data: "unhealthy",
      });

      const result = await makeAdapter().healthcheck();

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toEqual(
        new GenericError(
          `One Identity status check failed, status: ${status ?? "unknown"}`,
        ),
      );
    },
  );

  it("converts thrown healthcheck errors to GenericError", async () => {
    sdkMocks.getRequestHealthCheck.mockRejectedValueOnce(
      new Error("network unavailable"),
    );

    const result = await makeAdapter().healthcheck();

    expect(result._unsafeUnwrapErr()).toEqual(
      new GenericError("One Identity status check failed: network unavailable"),
    );
  });
});

describe("OneIdIdentityAssertionFetcherAdapter#getAssertion", () => {
  it("returns the parsed assertion and raw XML for a configured environment", async () => {
    const adapter = makeAdapter();

    const result = await adapter.getAssertion("UAT", ACCESS_TOKEN);

    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toMatchObject({
      assertion: { documentElement: { tagName: "samlp:Response" } },
      rawAssertion: A_VALID_XML,
      assertionRef: ASSERTION_REF,
      claims: { fiscalCode: FISCAL_CODE },
      type: "SAML",
    });
    expect(sdkMocks.getSamlAssertion).toHaveBeenCalledExactlyOnceWith({
      client: expect.anything(),
      query: { access_token: ACCESS_TOKEN },
      headers: { Accept: "application/xml" },
      parseAs: "text",
    });
  });

  it("returns an error when the requested environment is not configured", async () => {
    const result = await makeAdapter(false).getAssertion("UAT", ACCESS_TOKEN);

    expect(result._unsafeUnwrapErr()).toEqual(
      new GenericError('Missing OIDC configuration for environment "UAT"'),
    );
    expect(sdkMocks.getSamlAssertion).not.toHaveBeenCalled();
  });

  it.each([undefined, 201, 401, 500])(
    "returns an error for assertion response status %s",
    async (status) => {
      sdkMocks.getSamlAssertion.mockResolvedValueOnce({
        response: status === undefined ? undefined : { status },
        data: A_VALID_XML,
      });

      const result = await makeAdapter().getAssertion("PROD", ACCESS_TOKEN);

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toEqual(
        new GenericError(
          `Failed to get SAML response, status: ${status ?? "unknown"}`,
        ),
      );
    },
  );

  it("returns an error when the successful response has no body", async () => {
    sdkMocks.getSamlAssertion.mockResolvedValueOnce({
      response: { status: 200 },
    });

    const result = await makeAdapter().getAssertion("PROD", ACCESS_TOKEN);

    expect(result._unsafeUnwrapErr()).toBeInstanceOf(GenericError);
    expect(sdkMocks.getSamlAssertion).toHaveBeenCalledOnce();
  });

  it.each(["", "  \n"])(
    "rejects an assertion without a document root element: %j",
    async (xml) => {
      sdkMocks.getSamlAssertion.mockResolvedValueOnce(aResponse(200, xml));

      const result = await makeAdapter().getAssertion("PROD", ACCESS_TOKEN);

      expect(result._unsafeUnwrapErr()).toBeInstanceOf(ValidationError);
      expect(result._unsafeUnwrapErr().message).toContain(
        "Invalid XML in SAML response:",
      );
    },
  );

  it("returns an error when the assertion XML is malformed", async () => {
    sdkMocks.getSamlAssertion.mockResolvedValueOnce(
      aResponse(200, "<Assertion>"),
    );

    const result = await makeAdapter().getAssertion("PROD", ACCESS_TOKEN);

    expect(result._unsafeUnwrapErr()).toBeInstanceOf(ValidationError);
    expect(result._unsafeUnwrapErr().message).toContain(
      "Invalid XML in SAML response:",
    );
  });

  it.each([
    `<Response />`,
    A_VALID_XML.replaceAll(
      "urn:oasis:names:tc:SAML:2.0:protocol",
      "urn:wrong:protocol",
    ),
    `<root>${A_VALID_XML}</root>`,
    `<root>${A_VALID_XML}${A_VALID_XML}</root>`,
  ])(
    "rejects a missing, wrong-namespace or wrapped SAML Response root",
    async (xml) => {
      sdkMocks.getSamlAssertion.mockResolvedValueOnce(aResponse(200, xml));

      const result = await makeAdapter().getAssertion("PROD", ACCESS_TOKEN);

      expect(result._unsafeUnwrapErr()).toBeInstanceOf(ValidationError);
      expect(result._unsafeUnwrapErr().message).toContain(
        "Expected a SAML Response root element",
      );
    },
  );

  it.each([undefined, "", "invalid-reference", `sha256-${"b".repeat(43)}`])(
    "returns ValidationError for a missing, invalid or mismatched Response InResponseTo: %s",
    async (assertionRef) => {
      const xml = A_VALID_XML.replace(
        `InResponseTo="${ASSERTION_REF}"`,
        assertionRef === undefined ? "" : `InResponseTo="${assertionRef}"`,
      );
      sdkMocks.getSamlAssertion.mockResolvedValueOnce(aResponse(200, xml));

      const result = await makeAdapter().getAssertion("PROD", ACCESS_TOKEN);

      expect(result._unsafeUnwrapErr()).toBeInstanceOf(ValidationError);
      expect(result._unsafeUnwrapErr()).toEqual(
        new ValidationError(
          "SubjectConfirmationData InResponseTo does not match Response InResponseTo",
        ),
      );
    },
  );

  it.each([FISCAL_CODE, `  tinit-${FISCAL_CODE.toLowerCase()}  `])(
    "normalizes fiscalNumber %j",
    async (fiscalNumber) => {
      sdkMocks.getSamlAssertion.mockResolvedValueOnce(
        aResponse(
          200,
          A_VALID_XML.replace(`TINIT-${FISCAL_CODE}`, fiscalNumber),
        ),
      );

      const result = await makeAdapter().getAssertion("PROD", ACCESS_TOKEN);

      expect(result._unsafeUnwrap().claims.fiscalCode).toBe(FISCAL_CODE);
    },
  );

  it.each([
    A_VALID_XML.replace(`TINIT-${FISCAL_CODE}`, ""),
    A_VALID_XML.replace(`TINIT-${FISCAL_CODE}`, "invalid-fiscal-code"),
  ])("rejects an empty or invalid fiscal number", async (xml) => {
    sdkMocks.getSamlAssertion.mockResolvedValueOnce(aResponse(200, xml));

    const result = await makeAdapter().getAssertion("PROD", ACCESS_TOKEN);

    expect(result._unsafeUnwrapErr()).toBeInstanceOf(ValidationError);
    expect(result._unsafeUnwrapErr().message).toContain("Invalid fiscal code:");
  });

  it.each([
    "Assertion",
    "Subject",
    "SubjectConfirmation",
    "SubjectConfirmationData",
    "AttributeStatement",
  ])(
    "rejects missing, duplicate, nested or wrong-namespace direct %s elements",
    async (localName) => {
      const openingTag = `<saml:${localName}`;
      const start = A_VALID_XML.indexOf(
        `${openingTag}${localName === "SubjectConfirmationData" ? " " : ">"}`,
      );
      const closingTag =
        localName === "SubjectConfirmationData" ? "/>" : `</saml:${localName}>`;
      const end = A_VALID_XML.indexOf(closingTag, start) + closingTag.length;
      const elementXml = A_VALID_XML.slice(start, end);
      const variants = [
        "",
        `${elementXml}${elementXml}`,
        `<saml:Advice>${elementXml}</saml:Advice>`,
        elementXml.replace(
          openingTag,
          `${openingTag} xmlns:saml="urn:wrong:assertion"`,
        ),
      ];

      for (const replacement of variants) {
        sdkMocks.getSamlAssertion.mockResolvedValueOnce(
          aResponse(200, A_VALID_XML.replace(elementXml, replacement)),
        );

        const result = await makeAdapter().getAssertion("PROD", ACCESS_TOKEN);

        expect(result._unsafeUnwrapErr()).toBeInstanceOf(ValidationError);
        expect(result._unsafeUnwrapErr().message).toContain(
          `Expected exactly one ${localName} element`,
        );
      }
    },
  );

  it.each([undefined, "", "invalid-reference"])(
    "returns ValidationError for a missing or invalid SubjectConfirmationData reference: %s",
    async (assertionRef) => {
      const subjectXml = SUBJECT_XML.replace(
        `InResponseTo="${ASSERTION_REF}"`,
        assertionRef === undefined ? "" : `InResponseTo="${assertionRef}"`,
      );
      sdkMocks.getSamlAssertion.mockResolvedValueOnce(
        aResponse(200, A_VALID_XML.replace(SUBJECT_XML, subjectXml)),
      );

      const result = await makeAdapter().getAssertion("PROD", ACCESS_TOKEN);

      expect(result._unsafeUnwrapErr()).toBeInstanceOf(ValidationError);
      expect(result._unsafeUnwrapErr().message).toContain(
        "Could not extract assertion reference from the SAML assertion:",
      );
      expect(result._unsafeUnwrapErr().message).toContain(
        "Invalid SubjectConfirmationData InResponseTo:",
      );
    },
  );

  it.each(["", "invalid-reference"])(
    "rejects matching references with an invalid format: %j",
    async (assertionRef) => {
      sdkMocks.getSamlAssertion.mockResolvedValueOnce(
        aResponse(200, A_VALID_XML.replaceAll(ASSERTION_REF, assertionRef)),
      );

      const result = await makeAdapter().getAssertion("PROD", ACCESS_TOKEN);

      expect(result._unsafeUnwrapErr()).toBeInstanceOf(ValidationError);
      expect(result._unsafeUnwrapErr().message).toContain(
        "Invalid SubjectConfirmationData InResponseTo:",
      );
    },
  );

  it.each([
    ASSERTION_REF,
    `sha384-${"a".repeat(64)}`,
    `sha512-${"a".repeat(86)}`,
  ])("accepts matching valid references: %s", async (assertionRef) => {
    sdkMocks.getSamlAssertion.mockResolvedValueOnce(
      aResponse(200, A_VALID_XML.replaceAll(ASSERTION_REF, assertionRef)),
    );

    const result = await makeAdapter().getAssertion("PROD", ACCESS_TOKEN);

    expect(result._unsafeUnwrap().assertionRef).toBe(assertionRef);
  });

  it.each([
    ["missing attribute", "", "fiscalNumber attribute"],
    [
      "other attribute",
      FISCAL_ATTRIBUTE_XML.replace(
        'Name="fiscalNumber"',
        'Name="anotherAttribute"',
      ),
      "fiscalNumber attribute",
    ],
    [
      "duplicate attributes",
      FISCAL_ATTRIBUTE_XML.repeat(2),
      "fiscalNumber attribute",
    ],
    [
      "nested attribute",
      `<saml:Advice>${FISCAL_ATTRIBUTE_XML}</saml:Advice>`,
      "fiscalNumber attribute",
    ],
    [
      "wrong-namespace attribute",
      FISCAL_ATTRIBUTE_XML.replace(
        "<saml:Attribute ",
        '<saml:Attribute xmlns:saml="urn:wrong:assertion" ',
      ),
      "fiscalNumber attribute",
    ],
    [
      "missing value",
      '<saml:Attribute Name="fiscalNumber" />',
      "AttributeValue element",
    ],
    [
      "duplicate values",
      FISCAL_ATTRIBUTE_XML.replace(
        "</saml:AttributeValue>",
        `</saml:AttributeValue><saml:AttributeValue>TINIT-${FISCAL_CODE}</saml:AttributeValue>`,
      ),
      "AttributeValue element",
    ],
    [
      "nested value",
      FISCAL_ATTRIBUTE_XML.replace(
        "<saml:AttributeValue>",
        "<saml:Advice><saml:AttributeValue>",
      ).replace(
        "</saml:AttributeValue>",
        "</saml:AttributeValue></saml:Advice>",
      ),
      "AttributeValue element",
    ],
    [
      "wrong-namespace value",
      FISCAL_ATTRIBUTE_XML.replace(
        "<saml:AttributeValue>",
        '<saml:AttributeValue xmlns:saml="urn:wrong:assertion">',
      ),
      "AttributeValue element",
    ],
    [
      "nested scalar markup",
      FISCAL_ATTRIBUTE_XML.replace(
        `TINIT-${FISCAL_CODE}`,
        `<saml:NameID>TINIT-${FISCAL_CODE}</saml:NameID>`,
      ),
      "scalar text value",
    ],
  ])(
    "rejects fiscalNumber with %s",
    async (_name, attributeXml, errorMessage) => {
      sdkMocks.getSamlAssertion.mockResolvedValueOnce(
        aResponse(200, A_VALID_XML.replace(FISCAL_ATTRIBUTE_XML, attributeXml)),
      );

      const result = await makeAdapter().getAssertion("PROD", ACCESS_TOKEN);

      expect(result._unsafeUnwrapErr()).toBeInstanceOf(ValidationError);
      expect(result._unsafeUnwrapErr().message).toContain(errorMessage);
    },
  );

  it.each(["extensions", "advice"])(
    "does not use a reference from %s to validate a mismatched authoritative subject",
    async (location) => {
      const mismatchedSubject = SUBJECT_XML.replace(
        ASSERTION_REF,
        `sha256-${"b".repeat(43)}`,
      );
      const xml = A_VALID_XML.replace(SUBJECT_XML, mismatchedSubject);
      const xmlWithDecoy =
        location === "extensions"
          ? xml.replace(
              "<saml:Assertion>",
              `<samlp:Extensions>${SUBJECT_XML}</samlp:Extensions><saml:Assertion>`,
            )
          : xml.replace(
              "<saml:Assertion>",
              `<saml:Assertion><saml:Advice>${SUBJECT_XML}</saml:Advice>`,
            );
      sdkMocks.getSamlAssertion.mockResolvedValueOnce(
        aResponse(200, xmlWithDecoy),
      );

      const result = await makeAdapter().getAssertion("PROD", ACCESS_TOKEN);

      expect(result._unsafeUnwrapErr()).toBeInstanceOf(ValidationError);
      expect(result._unsafeUnwrapErr()).toEqual(
        new ValidationError(
          "SubjectConfirmationData InResponseTo does not match Response InResponseTo",
        ),
      );
    },
  );

  it.each(["extensions", "advice"])(
    "ignores fiscal-number decoys in %s and preserves the original XML",
    async (location) => {
      const decoy = FISCAL_ATTRIBUTE_XML.replace(
        FISCAL_CODE,
        "RSSMRA80A01H501U",
      );
      const xml =
        location === "extensions"
          ? A_VALID_XML.replace(
              "<saml:Assertion>",
              `<samlp:Extensions>${decoy}</samlp:Extensions><saml:Assertion>`,
            )
          : A_VALID_XML.replace(
              "<saml:Assertion>",
              `<saml:Assertion><saml:Advice><saml:Assertion>${decoy}</saml:Assertion></saml:Advice>`,
            );
      sdkMocks.getSamlAssertion.mockResolvedValueOnce(aResponse(200, xml));

      const result = await makeAdapter().getAssertion("PROD", ACCESS_TOKEN);

      expect(result._unsafeUnwrap()).toMatchObject({
        claims: { fiscalCode: FISCAL_CODE },
        assertionRef: ASSERTION_REF,
        rawAssertion: xml,
      });
    },
  );

  it("does not use an extension fiscal number when the Assertion has none", async () => {
    const xml = A_VALID_XML.replace(FISCAL_ATTRIBUTE_XML, "").replace(
      "<saml:Assertion>",
      `<samlp:Extensions>${FISCAL_ATTRIBUTE_XML}</samlp:Extensions><saml:Assertion>`,
    );
    sdkMocks.getSamlAssertion.mockResolvedValueOnce(aResponse(200, xml));

    const result = await makeAdapter().getAssertion("PROD", ACCESS_TOKEN);

    expect(result._unsafeUnwrapErr()).toBeInstanceOf(ValidationError);
    expect(result._unsafeUnwrapErr().message).toContain(
      "fiscalNumber attribute",
    );
  });

  it.each([
    A_VALID_XML.replaceAll("saml:", "assertion:").replace(
      "xmlns:saml=",
      "xmlns:assertion=",
    ),
    A_VALID_XML.replaceAll("saml:", "").replace("xmlns:saml=", "xmlns="),
  ])(
    "accepts equivalent namespace prefixes and the default assertion namespace",
    async (xml) => {
      sdkMocks.getSamlAssertion.mockResolvedValueOnce(aResponse(200, xml));

      const result = await makeAdapter().getAssertion("PROD", ACCESS_TOKEN);

      expect(result._unsafeUnwrap()).toMatchObject({
        claims: { fiscalCode: FISCAL_CODE },
        assertionRef: ASSERTION_REF,
        rawAssertion: xml,
      });
    },
  );

  it.each([
    "<Response /><Response />",
    "<Response attribute />",
    "<Response><Assertion></Response>",
  ])("rejects syntactically invalid XML: %s", async (xml) => {
    sdkMocks.getSamlAssertion.mockResolvedValueOnce(aResponse(200, xml));

    const result = await makeAdapter().getAssertion("PROD", ACCESS_TOKEN);

    expect(result._unsafeUnwrapErr()).toBeInstanceOf(ValidationError);
    expect(result._unsafeUnwrapErr().message).toContain(
      "Invalid XML in SAML response:",
    );
  });

  it("converts thrown SDK errors to GenericError", async () => {
    sdkMocks.getSamlAssertion.mockRejectedValueOnce(new Error("provider down"));

    const result = await makeAdapter().getAssertion("PROD", ACCESS_TOKEN);

    expect(result._unsafeUnwrapErr()).toEqual(
      new GenericError("Failed to get SAML assertion: provider down"),
    );
  });
});
