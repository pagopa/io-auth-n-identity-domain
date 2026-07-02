import { Result } from "neverthrow";

export interface HealthCheckOutboundPort {
  healthcheck(): Promise<Result<void, Error>>;
}
