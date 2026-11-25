import { GenericError } from "@pagopa/hexagonal-core";

export class OidcDiscoveryError extends GenericError {
  readonly reason = "discovery_failed";
}

export class InvalidAuthorizationEndpointError extends GenericError {
  readonly reason = "invalid_authorization_endpoint";
}

export class OidcCodeExchangeError extends GenericError {
  readonly reason = "code_exchange_failed";
}

export type AuthorizationEndpointError =
  | OidcDiscoveryError
  | InvalidAuthorizationEndpointError;

export type ExchangeError = OidcDiscoveryError | OidcCodeExchangeError;
