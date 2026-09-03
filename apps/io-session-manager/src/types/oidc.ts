import { JwkPublicKeyFromToken } from "@pagopa/ts-commons/lib/jwk";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { withDefault } from "@pagopa/ts-commons/lib/types";
import * as t from "io-ts";
import { AssertionRef } from "../generated/backend/AssertionRef";
import {
  JwkPubKeyHashAlgorithm,
  JwkPubKeyHashAlgorithmEnum,
} from "../generated/lollipop-api/JwkPubKeyHashAlgorithm";
import { LoginType } from "./fast-login";

/**
 * The OneIdentity (OIDC provider) configuration environment.
 */
export type OidcConfigurationEnv = t.TypeOf<typeof OidcConfigurationEnv>;
export const OidcConfigurationEnv = t.union(
  [t.literal("UAT"), t.literal("PROD")],
  "OidcConfigurationEnv",
);

/**
 * The SPID authentication level requested for the OIDC login flow.
 */
export type SpidAuthLevel = t.TypeOf<typeof SpidAuthLevel>;
export const SpidAuthLevel = t.union(
  [t.literal("SpidL2"), t.literal("SpidL3")],
  "SpidAuthLevel",
);

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

/**
 * The parameters returned by the `reserve` endpoint, needed by the client to
 * start the OIDC authorization flow with the selected OneIdentity
 * environment.
 */
export type ReserveResponse = t.TypeOf<typeof ReserveResponse>;
export const ReserveResponse = t.type({
  client_id: NonEmptyString,
  authorization_endpoint: NonEmptyString,
  nonce: NonEmptyString,
  redirect_uri: NonEmptyString,
  state: NonEmptyString,
});
