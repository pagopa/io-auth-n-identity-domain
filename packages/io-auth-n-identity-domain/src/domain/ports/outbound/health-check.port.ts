import { GenericError } from "@pagopa/hexagonal-core";
import { Result } from "neverthrow";

export interface HealthCheckOutboundPort {
  healthcheck(): Promise<Result<void, GenericError>>;
}
