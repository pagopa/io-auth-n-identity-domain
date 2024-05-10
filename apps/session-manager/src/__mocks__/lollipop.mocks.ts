import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";

import { JwkPublicKey } from "@pagopa/ts-commons/lib/jwk";
import { NonEmptyString, PatternString } from "@pagopa/ts-commons/lib/strings";
import * as jose from "jose";
import { vi } from "vitest";
import * as t from "io-ts";
import { AssertionFileName } from "../generated/lollipop-api/AssertionFileName";
import { PubKeyStatusEnum } from "../generated/lollipop-api/PubKeyStatus";
import { LcParams } from "../generated/lollipop-api/LcParams";
import { AssertionRefSha256 } from "../generated/lollipop-api/AssertionRefSha256";
import { AssertionRefSha512 } from "../generated/lollipop-api/AssertionRefSha512";
import { LollipopSignature } from "../generated/lollipop/LollipopSignature";
import { LollipopSignatureInput } from "../generated/lollipop/LollipopSignatureInput";
import { LollipopMethod } from "../generated/lollipop/LollipopMethod";
import { LollipopOriginalURL } from "../generated/lollipop/LollipopOriginalURL";
import { LollipopLocalsType } from "../types/lollipop";
import { SpidLevelEnum } from "../generated/backend/SpidLevel";
import { LoginTypeEnum } from "../types/fast-login";
import { AssertionTypeEnum } from "../generated/fast-login-api/AssertionType";
import { LollipopJWTAuthorization } from "../generated/fast-login-api/LollipopJWTAuthorization";
import { LollipopPublicKey } from "../generated/fast-login-api/LollipopPublicKey";
import { aFiscalCode } from "./user.mocks";
import { getASAMLResponse } from "./spid.mocks";

const Sha256Thumbprint = PatternString("^([A-Za-z0-9-_=]{1,44})$");
const Sha384Thumbprint = PatternString("^([A-Za-z0-9-_=]{1,66})$");
const Sha512Thumbprint = PatternString("^([A-Za-z0-9-_=]{1,88})$");

export const Thumbprint = t.union(
  [Sha256Thumbprint, Sha384Thumbprint, Sha512Thumbprint],
  "Thumbprint",
);

export type Thumbprint = t.TypeOf<typeof Thumbprint>;

export const anAssertionRef =
  "sha256-6LvipIvFuhyorHpUqK3HjySC5Y6gshXHFBhU9EJ4DoM=" as AssertionRefSha256;

const aBearerToken = "aBearerTokenJWT" as NonEmptyString;
const aPubKey = "aPubKey" as NonEmptyString;
export const aValidLCParamsResult: LcParams = {
  fiscal_code: aFiscalCode,
  assertion_file_name: `${aFiscalCode}-${anAssertionRef}` as AssertionFileName,
  assertion_type: AssertionTypeEnum.SAML,
  expired_at: new Date(),
  lc_authentication_bearer: aBearerToken as NonEmptyString,
  assertion_ref: anAssertionRef,
  pub_key: aPubKey,
  status: PubKeyStatusEnum.VALID,
  version: 1 as NonNegativeInteger,
  ttl: 900 as NonNegativeInteger,
};
export const aThumbprint =
  "6LvipIvFuhyorHpUqK3HjySC5Y6gshXHFBhU9EJ4DoM=" as Thumbprint;
export const anotherAssertionRef =
  "sha512-Dj51I0q8aPQ3ioaz9LMqGYujAYRbDNblAQbodDRXAMxmY6hsHqEl3F6SvhfJj5oPhcqdX1ldsgEvfMNXGUXBIw==" as AssertionRefSha512;

export const lollipopData = {
  assertionRef: anotherAssertionRef,
  loginType: LoginTypeEnum.LEGACY,
};

export const aJwkPubKey: JwkPublicKey = {
  kty: "EC",
  crv: "secp256k1",
  x: "Q8K81dZcC4DdKl52iW7bT0ubXXm2amN835M_v5AgpSE",
  y: "lLsw82Q414zPWPluI5BmdKHK6XbFfinc8aRqbZCEv0A",
};

export const anEncodedJwkPubKey = jose.base64url.encode(
  JSON.stringify(aJwkPubKey),
) as NonEmptyString;

export const aLollipopAssertion = getASAMLResponse(
  aFiscalCode,
  anotherAssertionRef as any,
) as NonEmptyString;
export const aSpidL3LollipopAssertion = getASAMLResponse(
  aFiscalCode,
  anotherAssertionRef as any,
  SpidLevelEnum["https://www.spid.gov.it/SpidL3"],
) as NonEmptyString;

export const aSignature =
  `sig1=:hNojB+wWw4A7SYF3qK1S01Y4UP5i2JZFYa2WOlMB4Np5iWmJSO0bDe2hrYRbcIWqVAFjuuCBRsB7lYQJkzbb6g==:` as LollipopSignature;
export const aSignatureInput =
  `sig1=("x-pagopa-lollipop-original-method" "x-pagopa-lollipop-original-url"); created=1618884475; keyid="${aThumbprint}"` as LollipopSignatureInput;
export const aLollipopOriginalMethod = "POST" as LollipopMethod;
export const aLollipopOriginalUrl =
  "https://api.pagopa.it" as LollipopOriginalURL;

export const anInvalidSignatureInput =
  `sig1=("x-pagopa-lollipop-original-method" "x-pagopa-lollipop-original-url"); created=1618884475; keyid="#an-invalid-thumbprint#"` as LollipopSignatureInput;

export const mockActivatePubKey = vi.fn();

export const lollipopRequiredHeaders = {
  signature:
    "sig1=:hNojB+wWw4A7SYF3qK1S01Y4UP5i2JZFYa2WOlMB4Np5iWmJSO0bDe2hrYRbcIWqVAFjuuCBRsB7lYQJkzbb6g==:",
  "signature-input": `sig1=("x-pagopa-lollipop-original-method" "x-pagopa-lollipop-original-url"); created=1618884475; keyid="${aThumbprint}"`,
  "x-pagopa-lollipop-original-method": "POST",
  "x-pagopa-lollipop-original-url": "https://api.pagopa.it",
};

export const lollipopParams: LollipopLocalsType = {
  signature: aSignature,
  "signature-input": aSignatureInput,
  "x-pagopa-lollipop-original-method": aLollipopOriginalMethod,
  "x-pagopa-lollipop-original-url": aLollipopOriginalUrl,
  "x-pagopa-lollipop-assertion-ref": anAssertionRef,
  "x-pagopa-lollipop-assertion-type": AssertionTypeEnum.SAML,
  "x-pagopa-lollipop-auth-jwt": "a bearer token" as LollipopJWTAuthorization,
  "x-pagopa-lollipop-public-key": "a pub key" as LollipopPublicKey,
  "x-pagopa-lollipop-user-id": aFiscalCode,
};
