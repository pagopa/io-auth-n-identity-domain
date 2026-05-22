export const PROXY_BASE_PATH = "/api/auth/v1";
export const FISCAL_CODE = "GRBGPP87L04L741X";
export const ASSERTION_REF =
  "sha256-6LvipIvFuhyorHpUqK3HjySC5Y6gshXHFBhU9EJ4DoM=";

export const SESSION_USER = {
  bpd_token:
    "4123ee213b64955212ea59e3beeaad1e5fdb3a36d22104164123ee213b64955212ea59e3beeaad1e5fdb3a36d2210416",
  created_at: 1518010929530,
  date_of_birth: "2000-06-02",
  family_name: "Garibaldi",
  fiscal_code: FISCAL_CODE,
  fims_token:
    "aaaa12213b64955212ea59e3beeaad1e5fdb3a36d2210bcdaaaa12213b64955212ea59e3beeaad1e5fdb3a36d2210bcd",
  myportal_token:
    "c4d6bc16ef30211fb3fa8855efecac21be04a7d032f8700dc4d6bc16ef30211fb3fa8855efecac21be04a7d032f8700d",
  name: "Giuseppe Maria",
  session_token:
    "c77de47586c841adbd1a1caeb90dce25dcecebed620488a4f932a6280b10ee99a77b6c494a8a6e6884ccbeb6d3fe736b",
  session_tracking_id: "a-ssn-id",
  spid_email: "garibaldi@spid.com",
  spid_level: "https://www.spid.gov.it/SpidL2",
  wallet_token:
    "5ba5b99a982da1aa5eb4fd8643124474fa17ee3016c13c617ab79d2e7c8624bb80105c0c0cae9864e035a0d31a715043",
  zendesk_token:
    "aaaa12213b64955212ea59e3beeaad1e5fdb3a36d2210abcaaaa12213b64955212ea59e3beeaad1e5fdb3a36d2210abc",
} as const;

export const PREVIOUS_SESSION_USER = {
  ...SESSION_USER,
  bpd_token:
    "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  fims_token:
    "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
  myportal_token:
    "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
  session_token:
    "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
  session_tracking_id: "previous-session-id",
  wallet_token:
    "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
  zendesk_token:
    "999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999",
} as const;

export const EXTENDED_PROFILE = {
  email: "custom-email@example.com",
  family_name: SESSION_USER.family_name,
  fiscal_code: FISCAL_CODE,
  has_profile: true,
  is_email_already_taken: true,
  is_email_enabled: true,
  is_email_validated: true,
  is_inbox_enabled: true,
  is_webhook_enabled: true,
  name: SESSION_USER.name,
  preferred_languages: ["it-IT"],
  service_preferences_settings: {
    mode: "AUTO",
  },
  version: 42,
} as const;

export const LOLLIPOP_HEADERS = {
  signature:
    "sig1=:hNojB+wWw4A7SYF3qK1S01Y4UP5i2JZFYa2WOlMB4Np5iWmJSO0bDe2hrYRbcIWqVAFjuuCBRsB7lYQJkzbb6g==:",
  "signature-input":
    'sig1=("x-pagopa-lollipop-original-method" "x-pagopa-lollipop-original-url"); created=1618884475; keyid="6LvipIvFuhyorHpUqK3HjySC5Y6gshXHFBhU9EJ4DoM="',
  "x-pagopa-lollipop-original-method": "POST",
  "x-pagopa-lollipop-original-url": "https://api.pagopa.it",
} as const;

export const FAST_LOGIN_SAML_RESPONSE = `<samlp:Response Destination="https://app-backend.dev.io.italia.it/assertionConsumerService" ID="_7080f453-78cb-4f57-9692-62dc8a5c23e8" InResponseTo="_2d2a89e99c7583e221b4" IssueInstant="2020-02-26T07:32:05Z" Version="2.0" xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol">
<saml:Issuer Format="urn:oasis:names:tc:SAML:2.0:nameid-format:entity">http://localhost:8080</saml:Issuer>
<samlp:Status><samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success"/></samlp:Status>
<saml:Assertion ID="_43568006-96d4-4dcc-84da-d98e01ea3a28" IssueInstant="2020-02-26T07:32:05Z" Version="2.0" xmlns:xs="http://www.w3.org/2001/XMLSchema">
<saml:Subject><saml:NameID Format="urn:oasis:names:tc:SAML:2.0:nameid-format:transient">_61c0122d-5e8e-48e5-98ce-d43bb3903404</saml:NameID></saml:Subject>
<saml:AuthnStatement AuthnInstant="2020-02-26T07:27:42Z"><saml:AuthnContext><saml:AuthnContextClassRef>https://www.spid.gov.it/SpidL2</saml:AuthnContextClassRef></saml:AuthnContext></saml:AuthnStatement>
<saml:AttributeStatement>
<saml:Attribute Name="name"><saml:AttributeValue>SpidValidator</saml:AttributeValue></saml:Attribute>
<saml:Attribute Name="familyName"><saml:AttributeValue>AgID</saml:AttributeValue></saml:Attribute>
<saml:Attribute Name="fiscalNumber"><saml:AttributeValue>TINIT-${FISCAL_CODE}</saml:AttributeValue></saml:Attribute>
<saml:Attribute Name="email"><saml:AttributeValue>spid.tech@agid.gov.it</saml:AttributeValue></saml:Attribute>
<saml:Attribute Name="dateOfBirth"><saml:AttributeValue>1970-01-01</saml:AttributeValue></saml:Attribute>
</saml:AttributeStatement>
</saml:Assertion>
</samlp:Response>`;
