import * as t from "io-ts";
import {
  FiscalCode,
  IPString,
  NonEmptyString
} from "@pagopa/ts-commons/lib/strings";
import { enumType } from "@pagopa/ts-commons/lib/types";
import { IsoDateFromString } from "@pagopa/ts-commons/lib/dates";
import { AssertionRef } from "../generated/definitions/fn-lollipop/AssertionRef";
import { AssertionType } from "../generated/definitions/fn-lollipop/AssertionType";
import { LollipopMethod } from "../generated/definitions/internal/LollipopMethod";
import { LollipopOriginalURL } from "../generated/definitions/internal/LollipopOriginalURL";
import { LollipopSignatureInput } from "../generated/definitions/internal/LollipopSignatureInput";
import { LollipopSignature } from "../generated/definitions/internal/LollipopSignature";
import { LollipopPublicKey } from "../generated/definitions/internal/LollipopPublicKey";
import { LVClientIp } from "../generated/definitions/internal/LVClientIp";

export const PUBLIC_KEY_HEADER_NAME = "x-pagopa-lollipop-public-key" as NonEmptyString;
export const ASSERTION_REF_HEADER_NAME = "x-pagopa-lollipop-assertion-ref";

export const LollipopHeaders = t.type({
  [ASSERTION_REF_HEADER_NAME]: AssertionRef,
  [PUBLIC_KEY_HEADER_NAME]: LollipopPublicKey,
  ["x-pagopa-lollipop-assertion-type"]: AssertionType,
  ["x-pagopa-lollipop-auth-jwt"]: NonEmptyString,
  ["x-pagopa-lollipop-original-method"]: LollipopMethod,
  ["x-pagopa-lollipop-original-url"]: LollipopOriginalURL,
  ["x-pagopa-lollipop-user-id"]: FiscalCode,

  // eslint-disable-next-line sort-keys
  ["signature"]: LollipopSignature,
  ["signature-input"]: LollipopSignatureInput
});
export type LollipopHeaders = t.TypeOf<typeof LollipopHeaders>;

export const FastLoginAdditionalHeaders = t.type({
  ["x-pagopa-lv-client-ip"]: LVClientIp
});
export type FastLoginAdditionalHeaders = t.TypeOf<
  typeof FastLoginAdditionalHeaders
>;

export enum JwkPubKeyHashAlgorithmEnum {
  "sha256" = "sha256",

  "sha384" = "sha384",

  "sha512" = "sha512"
}

/**
 * Represents the selected hashing algorithm for jwk thumbprint
 */
export type JwkPubKeyHashAlgorithm = t.TypeOf<typeof JwkPubKeyHashAlgorithm>;
export const JwkPubKeyHashAlgorithm = enumType<JwkPubKeyHashAlgorithmEnum>(
  JwkPubKeyHashAlgorithmEnum,
  "JwkPubKeyHashAlgorithm"
);

export const FastLoginAuditDoc = t.type({
  assertion_xml: t.string,
  client_ip: IPString,
  created_at: IsoDateFromString,
  lollipop_request: t.type({
    body: t.any,
    headers: LollipopHeaders
  })
});
export type FastLoginAuditDoc = t.TypeOf<typeof FastLoginAuditDoc>;
