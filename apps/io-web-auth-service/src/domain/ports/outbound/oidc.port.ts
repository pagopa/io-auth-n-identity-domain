import { type GenericError } from "@pagopa/hexagonal-core";
import { type Result } from "neverthrow";

import { type OidcEnvironment } from "../../value-objects/oidc.vo.js";

export type AuthorizationEndpointError = {
  reason: "discovery_failed" | "invalid_authorization_endpoint";
  error: GenericError;
};

/** Outbound port towards the OpenID Connect provider (OneIdentity). */
export interface OidcClientPort {
  /**
   * Returns the OIDC `authorization_endpoint` discovered from the provider
   * well-known metadata for the given environment.
   */
  readonly getAuthorizationEndpoint: (
    env: OidcEnvironment,
  ) => Promise<Result<URL, AuthorizationEndpointError>>;
}
