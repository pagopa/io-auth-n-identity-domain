import { GenericError } from "@pagopa/hexagonal-core";
import { HealthCheckOutboundPort } from "@pagopa/io-auth-n-identity-domain";
import { AuthEvent } from "@pagopa/io-auth-n-identity-session";
import { ResultAsync } from "neverthrow";

export interface AuthEventPort extends HealthCheckOutboundPort {
  sendEvent(eventData: AuthEvent): ResultAsync<void, GenericError>;
}
