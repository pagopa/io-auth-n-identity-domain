import {
  type AuthenticationError,
  type GenericError,
} from "@pagopa/hexagonal-core";
import { type Result } from "neverthrow";

import { type OidcClaims } from "../../value-objects/oidc-claims.vo.js";
import { type OidcConfigurationEnv } from "../../value-objects/oidc.vo.js";

/**
 * Parameters required to exchange an OIDC authorization code for tokens.
 *
 * `expectedState` and `expectedNonce` are the values reserved at the start of
 * the login flow (stored server-side keyed by `state`) and are validated
 * against the incoming callback to prevent replay/CSRF.
 */
export type OidcExchangeParams = {
  env: OidcConfigurationEnv;
  query: Readonly<Record<string, string>>;
  expectedState: string;
  expectedNonce: string;
};

/**
 * Outbound port that performs the OpenID Connect authorization-code grant and
 * returns the validated ID token claims.
 */
export interface OidcPort {
  readonly exchange: (
    params: OidcExchangeParams,
  ) => Promise<Result<OidcClaims, AuthenticationError | GenericError>>;
}
