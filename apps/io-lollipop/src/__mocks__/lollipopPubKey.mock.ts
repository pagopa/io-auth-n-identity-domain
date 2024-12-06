import * as jose from "jose";

import { JwkPublicKey } from "@pagopa/ts-commons/lib/jwk";
import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";
import { FiscalCode, NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { CosmosResource } from "@pagopa/io-functions-commons/dist/src/utils/cosmosdb_model";

import { AssertionTypeEnum } from "../generated/definitions/internal/AssertionType";
import { AssertionRef } from "../generated/definitions/internal/AssertionRef";
import { PubKeyStatusEnum } from "../generated/definitions/internal/PubKeyStatus";

import { PendingLolliPopPubKeys } from "../model/lollipop_keys";
import { AssertionFileName } from "../generated/definitions/internal/AssertionFileName";

export const aFiscalCode = "AAAAAA89S20I111X" as FiscalCode;

export const anInvalidJwk: JwkPublicKey = {
  alg: "",
  e: "e",
  kty: "RSA",
  n: "n"
};
export const aValidJwk: JwkPublicKey = {
  kty: "EC",
  crv: "P-256",
  x: "SVqB4JcUD6lsfvqMr-OKUNUphdNn64Eay60978ZlL74",
  y: "lf0u0pMj4lGAzZix5u4Cm5CMQIgMNpkwy163wtKYVKI"
};
export const toEncodedJwk = (jwk: JwkPublicKey) =>
  jose.base64url.encode(JSON.stringify(jwk)) as NonEmptyString;

export const aValidSha256AssertionRef = "sha256-a7qE0Y0DyqeOFFREIQSLKfu5WlbckdxVXKFasfcI-Dg" as AssertionRef;
export const aValidSha512AssertionRef = "sha512-nX5CfUc5R-FoYKYZwvQMuc4Tt-heb7vHi_O-AMUSqHNVCw9kNaN2SVuN-DXtGXyUhrcVcQdCyY6FVzl_vyWXNA" as AssertionRef;

export const aPendingSha256LollipopPubKey: PendingLolliPopPubKeys = {
  assertionRef: aValidSha256AssertionRef,
  pubKey: toEncodedJwk(aValidJwk),
  status: PubKeyStatusEnum.PENDING
};

// --------------------
// Retrieved models
// --------------------

// CosmosResourceMetadata
export const aCosmosResourceMetadata: Omit<CosmosResource, "id"> = {
  _etag: "_etag",
  _rid: "_rid",
  _self: "_self",
  _ts: 1
};

export const aRetrievedPendingLollipopPubKeySha256 = {
  ...aCosmosResourceMetadata,
  ...aPendingSha256LollipopPubKey
};

export const aRetrievedValidLollipopPubKeySha256 = {
  ...aCosmosResourceMetadata,
  ...aPendingSha256LollipopPubKey,
  status: PubKeyStatusEnum.VALID,
  assertionFileName: `${aFiscalCode}-${aValidSha256AssertionRef}` as AssertionFileName,
  assertionType: AssertionTypeEnum.SAML,
  expiredAt: new Date(),
  fiscalCode: aFiscalCode,
  pubKey: toEncodedJwk(aValidJwk),
  ttl: 900 as NonNegativeInteger
};

export const aRetrievedPendingLollipopPubKeySha512 = {
  ...aCosmosResourceMetadata,
  ...aPendingSha256LollipopPubKey,
  assertionRef: aValidSha512AssertionRef
};
