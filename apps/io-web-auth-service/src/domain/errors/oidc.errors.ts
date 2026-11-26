import { GenericError } from "@pagopa/hexagonal-core";

export class MissingOidcConfigurationError extends GenericError {
  readonly reason = "missing_oidc_configuration";
}

export class OidcDiscoveryError extends GenericError {
  readonly reason = "discovery_failed";
}

export class InvalidAuthorizationEndpointError extends GenericError {
  readonly reason = "invalid_authorization_endpoint";
}

export class OidcCodeExchangeError extends GenericError {
  readonly reason = "code_exchange_failed";
}

export type OidcConfigurationError =
  | MissingOidcConfigurationError
  | OidcDiscoveryError;

export type AuthorizationEndpointError =
  | OidcConfigurationError
  | InvalidAuthorizationEndpointError;

export type ExchangeError = OidcConfigurationError | OidcCodeExchangeError;
