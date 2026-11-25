import { type BaseError, type FiscalCode } from "@pagopa/hexagonal-core";
import { HealthCheckOutboundPort } from "@pagopa/io-auth-n-identity-domain";
import { type Result } from "neverthrow";

export interface LockedProfilesPort extends HealthCheckOutboundPort {
  isLocked(fiscalCode: FiscalCode): Promise<Result<boolean, BaseError>>;
}
