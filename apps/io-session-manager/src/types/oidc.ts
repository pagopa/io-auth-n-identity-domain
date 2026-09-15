import { JwkPublicKeyFromToken } from "@pagopa/ts-commons/lib/jwk";
import {
  EmailString,
  FiscalCode,
  NonEmptyString,
} from "@pagopa/ts-commons/lib/strings";
import { withDefault } from "@pagopa/ts-commons/lib/types";
import * as t from "io-ts";
import * as E from "fp-ts/lib/Either";
import { AssertionRef } from "../generated/backend/AssertionRef";
import {
  JwkPubKeyHashAlgorithm,
  JwkPubKeyHashAlgorithmEnum,
} from "../generated/lollipop-api/JwkPubKeyHashAlgorithm";
import { LoginType } from "./fast-login";
import { OidcConfigurationEnv } from "../generated/backend/OidcConfigurationEnv";
import { SpidAuthLevel } from "../generated/backend/SpidAuthLevel";
import { pipe } from "fp-ts/lib/function";
import { DateFromString } from "@pagopa/ts-commons/lib/dates";
import { SpidLevel } from "./spid-level";

export type ReserveInput = t.TypeOf<typeof ReserveInput>;
export const ReserveInput = t.intersection([
  t.type({
    env: OidcConfigurationEnv,
    minAuthLevel: SpidAuthLevel,
    jwk: JwkPublicKeyFromToken,
    jwkPubKeyHashAlgorithm: withDefault(
      JwkPubKeyHashAlgorithm,
      JwkPubKeyHashAlgorithmEnum.sha256,
    ),
  }),
  t.partial({
    currentUser: NonEmptyString,
    loginType: LoginType,
  }),
]);

/**
 * Data associated to a reserved OIDC authorization request, stored
 * server-side (keyed by `state`) between the `reserve` and `callback` steps
 * of the OneIdentity login flow.
 */
export type LoginAusiliarData = t.TypeOf<typeof LoginAusiliarData>;
export const LoginAusiliarData = t.intersection([
  t.type({
    clientId: NonEmptyString,
    lollipopAssertionRef: AssertionRef,
    minAuthLevel: SpidAuthLevel,
    nonce: NonEmptyString,
    oidcConfigurationEnv: OidcConfigurationEnv,
  }),
  t.partial({
    currentUser: NonEmptyString,
    loginType: LoginType,
  }),
]);

export type CallbackSuccessInput = t.TypeOf<typeof CallbackSuccessInput>;
export const CallbackSuccessInput = t.type({
  code: NonEmptyString,
  state: NonEmptyString,
});

export type CallbackErrorInput = t.TypeOf<typeof CallbackErrorInput>;
export const CallbackErrorInput = t.intersection([
  t.type({
    state: NonEmptyString,
    error: NonEmptyString,
  }),
  t.partial({
    error_description: NonEmptyString,
  }),
]);

export type ExchangeCodeAPIResponse = t.TypeOf<typeof ExchangeCodeAPIResponse>;
export const ExchangeCodeAPIResponse = t.type({
  access_token: NonEmptyString,
  id_token: NonEmptyString,
});

const tinitReplacerDecoder = new t.Type(
  "tinitReplacerDecoder",
  t.string.is,
  (i, context) =>
    pipe(
      t.string.decode(i),
      E.map((s) => t.success(s.replace(/^TINIT-/, ""))),
      E.getOrElse(() => t.failure(i, context)),
    ),
  (s) => s.toString(),
);
const fiscalCodeDecoderWithReplacer = tinitReplacerDecoder.pipe(FiscalCode);

export type OIDCExpectedClaims = t.TypeOf<typeof OIDCExpectedClaims>;
export const OIDCExpectedClaims = t.intersection([
  t.type({
    fiscalNumber: fiscalCodeDecoderWithReplacer,
    name: NonEmptyString,
    familyName: NonEmptyString,
    dateOfBirth: DateFromString,
    // `acr` carries the SPID authentication level as its canonical URL.
    acr: SpidLevel,
    // `iss` is the OneID issuer, used as the identity provider reference.
    iss: NonEmptyString,
  }),
  t.partial({
    email: EmailString,
  }),
]);

export type ExchangeCodeResult = t.TypeOf<typeof ExchangeCodeResult>;
export const ExchangeCodeResult = t.type({
  access_token: NonEmptyString,
  idTokenClaims: OIDCExpectedClaims,
});
