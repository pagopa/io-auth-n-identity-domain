import * as jose from "jose";

export const functionsMasterKey = "io-fast-login-backend-tests-master-key";
export const lollipopApiKey = "io-fast-login-backend-tests-lollipop-api-key";
export const fastLoginAuditContainerName = "logs";

export const generateNonceScenarioName = "generate-nonce-happy-path";
export const fastLoginScenarioName = "fast-login-happy-path";

export const fastLoginFixture = {
  assertionRef: "sha256-iwBFlFaCWaLnrCckGIyWMJBnfDkEJ-mgxZVzGICmkwU",
  clientIp: "10.0.0.1",
  lollipopAuthJwt: "aValidJWT",
  nonce: "195ace7b-1262-4a70-b520-7fbae5305a26",
  originalMethod: "POST",
  originalUrl: "https://api-app.io.pagopa.it/api/v1/fast-login",
  signature:
    "sig1=:GPJHMjxsyAB29V271sW6yozbM6gskQ4Jr0HtJzwmiM7Bsm09i5dRhWc0zIDbuWAU/bJmX4FX/CTeWL9Q5ivCTw==:",
  userId: "AAAAAA89S20I111X"
} as const;

const fastLoginPublicJwk = {
  crv: "P-256",
  kty: "EC",
  x: "NYvuK5KwdMSelFJgPnL0fsxizwOKw0WbQyANB4O6l2c",
  y: "qK9Zyso1CCwsUk985hnO5WEP3enSxpuD1n5JqtmZIEE"
} as const;

export const fastLoginSignatureInput = `sig1=("x-pagopa-lollipop-original-method" "x-pagopa-lollipop-original-url");created=1698315748;nonce="${fastLoginFixture.nonce}";alg="ecdsa-p256-sha256";keyid="iwBFlFaCWaLnrCckGIyWMJBnfDkEJ-mgxZVzGICmkwU"`;

export const buildFastLoginHeaders = (): Record<string, string> => ({
  "x-pagopa-lollipop-assertion-ref": fastLoginFixture.assertionRef,
  "x-pagopa-lollipop-assertion-type": "SAML",
  "x-pagopa-lollipop-auth-jwt": fastLoginFixture.lollipopAuthJwt,
  "x-pagopa-lollipop-original-method": fastLoginFixture.originalMethod,
  "x-pagopa-lollipop-original-url": fastLoginFixture.originalUrl,
  "x-pagopa-lollipop-public-key": jose.base64url.encode(
    JSON.stringify(fastLoginPublicJwk)
  ),
  "x-pagopa-lollipop-user-id": fastLoginFixture.userId,
  "x-pagopa-lv-client-ip": fastLoginFixture.clientIp,
  signature: fastLoginFixture.signature,
  "signature-input": fastLoginSignatureInput
});

export const nonceRedisKey = (nonce: string): string =>
  `FNFASTLOGIN-NONCE-${nonce}`;

export const buildFastLoginSamlResponse = (): string => `<?xml version="1.0" encoding="UTF-8"?>
<saml2p:Response xmlns:saml2="urn:oasis:names:tc:SAML:2.0:assertion" xmlns:saml2p="urn:oasis:names:tc:SAML:2.0:protocol">
  <saml2:Assertion>
    <saml2:Subject>
      <saml2:SubjectConfirmation>
        <saml2:SubjectConfirmationData InResponseTo="${fastLoginFixture.assertionRef}" />
      </saml2:SubjectConfirmation>
    </saml2:Subject>
    <saml2:AttributeStatement>
      <saml2:Attribute Name="fiscalNumber">
        <saml2:AttributeValue>TINIT-${fastLoginFixture.userId}</saml2:AttributeValue>
      </saml2:Attribute>
    </saml2:AttributeStatement>
  </saml2:Assertion>
</saml2p:Response>`;
