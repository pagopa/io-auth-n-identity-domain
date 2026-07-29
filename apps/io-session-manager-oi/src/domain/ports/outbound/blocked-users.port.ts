import { type BaseError, type FiscalCode } from "@pagopa/hexagonal-core";
import { HealthCheckOutboundPort } from "@pagopa/io-auth-n-identity-domain";
import { type Result } from "neverthrow";

export interface BlockedUsersPort extends HealthCheckOutboundPort {
  /**
   * Checks whether the given fiscal code is present in the
   * blocked-users collection.
   */
  isBlocked(fiscalCode: FiscalCode): Promise<Result<boolean, BaseError>>;
}
