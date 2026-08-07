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
 * `code` and `state` are the values received on the callback; `state` and
 * `expectedNonce` are validated against the values reserved at the start of the
 * login flow (stored server-side keyed by `state`) to prevent replay/CSRF.
 */
export type OidcExchangeParamsDTO = {
  env: OidcConfigurationEnv;
  code: string;
  state: string;
  expectedNonce: string;
};

/**
 * Outbound port that performs the OpenID Connect authorization-code grant and
 * returns the validated ID token claims.
 */
export interface OidcPort {
  readonly exchange: (
    params: OidcExchangeParamsDTO,
  ) => Promise<Result<OidcClaims, AuthenticationError | GenericError>>;
}
