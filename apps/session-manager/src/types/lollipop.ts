import * as t from "io-ts";
import {
  FiscalCode,
  NonEmptyString,
  PatternString,
} from "@pagopa/ts-commons/lib/strings";
import { LollipopSignature } from "../generated/fast-login-api/LollipopSignature";
import { LollipopSignatureInput } from "../generated/fast-login-api/LollipopSignatureInput";
import { LollipopMethod } from "../generated/fast-login-api/LollipopMethod";
import { LollipopOriginalURL } from "../generated/fast-login-api/LollipopOriginalURL";
import { AssertionRef } from "../generated/backend/AssertionRef";
import { AssertionType } from "../generated/fast-login-api/AssertionType";
import { JwkPubKeyToken } from "../generated/lollipop-api/JwkPubKeyToken";
import { LollipopContentDigest } from "../generated/lollipop/LollipopContentDigest";

export const LollipopRequiredHeaders = t.intersection([
  t.type({
    signature: LollipopSignature,
    ["signature-input"]: LollipopSignatureInput,
    ["x-pagopa-lollipop-original-method"]: LollipopMethod,
    ["x-pagopa-lollipop-original-url"]: LollipopOriginalURL,
  }),
  t.partial({ ["content-digest"]: LollipopContentDigest }),
]);
export type LollipopRequiredHeaders = t.TypeOf<typeof LollipopRequiredHeaders>;

export const LollipopLocalsType = t.intersection([
  LollipopRequiredHeaders,
  t.type({
    ["x-pagopa-lollipop-assertion-ref"]: AssertionRef,
    ["x-pagopa-lollipop-assertion-type"]: AssertionType,
    ["x-pagopa-lollipop-auth-jwt"]: NonEmptyString,
    ["x-pagopa-lollipop-public-key"]: JwkPubKeyToken,
    ["x-pagopa-lollipop-user-id"]: FiscalCode,
  }),
  t.partial({
    body: t.any,
    ["content-digest"]: LollipopContentDigest,
  }),
]);
export type LollipopLocalsType = t.TypeOf<typeof LollipopLocalsType>;

const Sha256Thumbprint = PatternString("^([A-Za-z0-9-_=]{1,44})$");
const Sha384Thumbprint = PatternString("^([A-Za-z0-9-_=]{1,66})$");
const Sha512Thumbprint = PatternString("^([A-Za-z0-9-_=]{1,88})$");

export const Thumbprint = t.union(
  [Sha256Thumbprint, Sha384Thumbprint, Sha512Thumbprint],
  "Thumbprint",
);

export type Thumbprint = t.TypeOf<typeof Thumbprint>;
