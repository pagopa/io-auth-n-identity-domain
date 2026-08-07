import { GenericError } from "@pagopa/hexagonal-core";
import { HealthCheckOutboundPort } from "@pagopa/io-auth-n-identity-domain";
import { ResultAsync } from "neverthrow";
import { AuthEvent } from "../../value-objects/events/index.js";

export interface AuthEventPort extends HealthCheckOutboundPort {
  sendEvent(eventData: AuthEvent): ResultAsync<void, GenericError>;
}
