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
import { OidcConfigurationEnv } from "../generated/backend/OidcConfigurationEnv";
import { SpidAuthLevel } from "../generated/backend/SpidAuthLevel";

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
