import { NonEmptyString } from "@pagopa/hexagonal-core";
import { type Result } from "neverthrow";

import {
  type AuthorizationEndpointError,
  type ExchangeError,
  type OidcCodeExchangeError,
  type OidcDiscoveryError,
} from "../../errors/oidc.errors.js";
import { type OidcClaims } from "../../value-objects/oidc-claims.vo.js";
import { type OidcEnvironment } from "../../value-objects/oidc.vo.js";

/**
 * Parameters required to exchange an OIDC authorization code for tokens.
 *
 * `code` and `state` are the values received on the callback; `state` and
 * `expectedNonce` are validated against the values reserved at the start of the
 * login flow (stored server-side keyed by `state`) to prevent replay/CSRF.
 */
export type OidcExchangeParams = {
  env: OidcEnvironment;
  code: NonEmptyString;
  state: NonEmptyString;
  expectedNonce: NonEmptyString;
};

/** Outbound port towards the OpenID Connect provider (OneIdentity). */
export interface OidcClientPort {
  /**
   * Performs the authorization-code grant and returns the validated ID token
   * claims.
   * Returns an {@link OidcDiscoveryError} when the provider configuration
   * cannot be resolved, or an {@link OidcCodeExchangeError} when the grant fails
   * or the ID token claims are invalid.
   */
  readonly exchange: (
    params: OidcExchangeParams,
  ) => Promise<Result<OidcClaims, ExchangeError>>;

  /**
   * Returns the OIDC `authorization_endpoint` discovered from the provider
   * well-known metadata for the given environment.
   */
  readonly getAuthorizationEndpoint: (
    env: OidcEnvironment,
  ) => Promise<Result<URL, AuthorizationEndpointError>>;
}
