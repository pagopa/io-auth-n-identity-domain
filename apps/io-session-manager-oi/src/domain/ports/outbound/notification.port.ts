import { FiscalCode, GenericError } from "@pagopa/hexagonal-core";
import { HealthCheckOutboundPort } from "@pagopa/io-auth-n-identity-domain";
import { Result } from "neverthrow";

export interface NotificationPort extends HealthCheckOutboundPort {
  /**
   * Deletes the installation for the given user.
   *
   * @param fiscalCode the fiscal code of the user whose installation should be deleted
   * @returns a promise that resolves when the installation has been deleted
   */
  deleteInstallation(
    fiscalCode: FiscalCode,
  ): Promise<Result<undefined, GenericError>>;
}
