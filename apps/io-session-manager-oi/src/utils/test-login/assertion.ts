import type { FiscalCode, NonEmptyString } from "@pagopa/hexagonal-core";
import type { LollipopAssertionRef } from "@pagopa/io-auth-n-identity-domain";
import type { SpidLevel } from "@pagopa/io-auth-n-identity-session/value-objects";

// Fixed identity data used for every test-login user
export const TEST_LOGIN_USER_DATA = {
  name: "Mario" as NonEmptyString,
  familyName: "Rossi" as NonEmptyString,
  dateOfBirth: "2000-06-02",
  spidLevel: "https://www.spid.gov.it/SpidL2" as SpidLevel,
  identityProvider: "https://idp.mock.it" as NonEmptyString,
} as const;

type MockedSamlAssertionParams = {
  fiscalCode: FiscalCode;
  // The Lollipop assertion ref, bound to the SAML assertion through InResponseTo
  inResponseTo: LollipopAssertionRef;
  spidLevel?: SpidLevel;
  name?: string;
  familyName?: string;
  dateOfBirth?: string;
};

/**
 * Builds the mocked SAML assertion used by the test-login flow.
 * It is NOT a valid signed assertion: it is meant to be stored as the
 * Lollipop assertion for test users only.
 */
export const getMockedSamlAssertion = ({
  fiscalCode,
  inResponseTo,
  spidLevel = TEST_LOGIN_USER_DATA.spidLevel,
  name = TEST_LOGIN_USER_DATA.name,
  familyName = TEST_LOGIN_USER_DATA.familyName,
  dateOfBirth = TEST_LOGIN_USER_DATA.dateOfBirth,
}: MockedSamlAssertionParams): NonEmptyString =>
  `<saml2:Assertion
    ID="_43568006-96d4-4dcc-84da-d98e01ea3a28"
    IssueInstant="2020-02-26T07:32:05Z"
    Version="2.0"
    xmlns:saml2="urn:oasis:names:tc:SAML:2.0:assertion"
    xmlns:xs="http://www.w3.org/2001/XMLSchema"
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  >
    <saml2:Issuer Format="urn:oasis:names:tc:SAML:2.0:nameid-format:entity">
      http://localhost:8080
    </saml2:Issuer>
    <ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
      <ds:SignedInfo>
        <ds:CanonicalizationMethod
          Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"
        />
        <ds:SignatureMethod
          Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"
        />
        <ds:Reference URI="#_43568006-96d4-4dcc-84da-d98e01ea3a28">
          <ds:Transforms>
            <ds:Transform
              Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"
            />
            <ds:Transform Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#" />
          </ds:Transforms>
          <ds:DigestMethod
            Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"
          />
          <ds:DigestValue>
            /VIQSQkyyNQkdlgLOCFcTAg0Oy78b2Sy9GcaWeO6hb8=
          </ds:DigestValue>
        </ds:Reference>
      </ds:SignedInfo>
      <ds:SignatureValue>
        ZwOttAyJZ774CPdnfjnvExwqtRXS3cvXqgo/nnPF2CsZmoBd0V11FqgXpj2hD5HkQ4fiwpNjn319SeId8s9M8RBfWPVzD52pgm1M3nT76+qDf+GWrCnK8CgkskPId798BugCmgPuHul9XKKDKC0Ajj4THtetRklvmxkpTzJy8CgwV79pbQwLMTHsiIRed3X25rjqhtuVUBWB2BKN0RC4bsoKBrDwa4UYDZ/4n68zm0AVNP8xpTOgGDm1sGeMwqdmccITDk17OLWUsgX2WGPdwFIAUsLfs1zw9z/lF5wwEuaz7GxS3pg5P3yGg6VqM7fj4HBuWop/oNxYUHixULxbQw==
      </ds:SignatureValue>
      <ds:KeyInfo>
        <ds:X509Data>
          <ds:X509Certificate>
            MIIEGDCCAwCgAwIBAgIJAOrYj9oLEJCwMA0GCSqGSIb3DQEBCwUAMGUxCzAJBgNVBAYTAklUMQ4wDAYDVQQIEwVJdGFseTENMAsGA1UEBxMEUm9tZTENMAsGA1UEChMEQWdJRDESMBAGA1UECxMJQWdJRCBURVNUMRQwEgYDVQQDEwthZ2lkLmdvdi5pdDAeFw0xOTA0MTExMDAyMDhaFw0yNTAzMDgxMDAyMDhaMGUxCzAJBgNVBAYTAklUMQ4wDAYDVQQIEwVJdGFseTENMAsGA1UEBxMEUm9tZTENMAsGA1UEChMEQWdJRDESMBAGA1UECxMJQWdJRCBURVNUMRQwEgYDVQQDEwthZ2lkLmdvdi5pdDCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBAK8kJVo+ugRrbbv9xhXCuVrqi4B7/MQzQc62ocwlFFujJNd4m1mXkUHFbgvwhRkQqo2DAmFeHiwCkJT3K1eeXIFhNFFroEzGPzONyekLpjNvmYIs1CFvirGOj0bkEiGaKEs+/umzGjxIhy5JQlqXE96y1+Izp2QhJimDK0/KNij8I1bzxseP0Ygc4SFveKS+7QO+PrLzWklEWGMs4DM5Zc3VRK7g4LWPWZhKdImC1rnS+/lEmHSvHisdVp/DJtbSrZwSYTRvTTz5IZDSq4kAzrDfpj16h7b3t3nFGc8UoY2Ro4tRZ3ahJ2r3b79yK6C5phY7CAANuW3gDdhVjiBNYs0CAwEAAaOByjCBxzAdBgNVHQ4EFgQU3/7kV2tbdFtphbSA4LH7+w8SkcwwgZcGA1UdIwSBjzCBjIAU3/7kV2tbdFtphbSA4LH7+w8SkcyhaaRnMGUxCzAJBgNVBAYTAklUMQ4wDAYDVQQIEwVJdGFseTENMAsGA1UEBxMEUm9tZTENMAsGA1UEChMEQWdJRDESMBAGA1UECxMJQWdJRCBURVNUMRQwEgYDVQQDEwthZ2lkLmdvdi5pdIIJAOrYj9oLEJCwMAwGA1UdEwQFMAMBAf8wDQYJKoZIhvcNAQELBQADggEBAJNFqXg/V3aimJKUmUaqmQEEoSc3qvXFITvT5f5bKw9yk/NVhR6wndL+z/24h1OdRqs76blgH8k116qWNkkDtt0AlSjQOx5qvFYh1UviOjNdRI4WkYONSw+vuavcx+fB6O5JDHNmMhMySKTnmRqTkyhjrch7zaFIWUSV7hsBuxpqmrWDoLWdXbV3eFH3mINA5AoIY/m0bZtzZ7YNgiFWzxQgekpxd0vcTseMnCcXnsAlctdir0FoCZztxMuZjlBjwLTtM6Ry3/48LMM8Z+lw7NMciKLLTGQyU8XmKKSSOh0dGh5Lrlt5GxIIJkH81C0YimWebz8464QPL3RbLnTKg+c=
          </ds:X509Certificate>
        </ds:X509Data>
      </ds:KeyInfo>
    </ds:Signature>
    <saml2:Subject>
      <saml2:NameID
        Format="urn:oasis:names:tc:SAML:2.0:nameid-format:transient"
        NameQualifier="https://validator.spid.gov.it"
      >
        _61c0122d-5e8e-48e5-98ce-d43bb3903404
      </saml2:NameID>
      <saml2:SubjectConfirmation Method="urn:oasis:names:tc:SAML:2.0:cm:bearer">
        <saml2:SubjectConfirmationData
          InResponseTo="${inResponseTo}"
          NotOnOrAfter="2020-02-26T07:32:05Z"
          Recipient="https://app-backend.dev.io.italia.it/assertionConsumerService"
        />
      </saml2:SubjectConfirmation>
    </saml2:Subject>
    <saml2:Conditions
      NotBefore="2020-02-26T07:27:42Z"
      NotOnOrAfter="2020-02-26T07:32:05Z"
    >
      <saml2:AudienceRestriction>
        <saml2:Audience> https://app-backend.dev.io.italia.it </saml2:Audience>
      </saml2:AudienceRestriction>
    </saml2:Conditions>
    <saml2:AuthnStatement
      AuthnInstant="2020-02-26T07:27:42Z"
      SessionIndex="_09d40021-a5f7-4c1c-8388-cd737546eec3"
    >
      <saml2:AuthnContext>
        <saml2:AuthnContextClassRef>
          ${spidLevel}
        </saml2:AuthnContextClassRef>
      </saml2:AuthnContext>
    </saml2:AuthnStatement>
    <saml2:AttributeStatement>
      <saml2:Attribute
        Name="name"
        NameFormat="urn:oasis:names:tc:SAML:2.0:attrname-format:basic"
      >
        <saml2:AttributeValue
          xmlns:xs="http://www.w3.org/2001/XMLSchema"
          xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
          xsi:type="xs:string"
        >
          ${name}
        </saml2:AttributeValue>
      </saml2:Attribute>
      <saml2:Attribute
        Name="familyName"
        NameFormat="urn:oasis:names:tc:SAML:2.0:attrname-format:basic"
      >
        <saml2:AttributeValue
          xmlns:xs="http://www.w3.org/2001/XMLSchema"
          xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
          xsi:type="xs:string"
        >
          ${familyName}
        </saml2:AttributeValue>
      </saml2:Attribute>
      <saml2:Attribute
        Name="fiscalNumber"
        NameFormat="urn:oasis:names:tc:SAML:2.0:attrname-format:basic"
      >
        <saml2:AttributeValue
          xmlns:xs="http://www.w3.org/2001/XMLSchema"
          xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
          xsi:type="xs:string"
        >
          TINIT-${fiscalCode}
        </saml2:AttributeValue>
      </saml2:Attribute>
      <saml2:Attribute
        Name="dateOfBirth"
        NameFormat="urn:oasis:names:tc:SAML:2.0:attrname-format:basic"
      >
        <saml2:AttributeValue
          xmlns:xs="http://www.w3.org/2001/XMLSchema"
          xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
          xsi:type="xs:date"
        >
          ${dateOfBirth}
        </saml2:AttributeValue>
      </saml2:Attribute>
    </saml2:AttributeStatement>
  </saml2:Assertion>` as NonEmptyString;
