import { FiscalCode, GenericError } from "@pagopa/hexagonal-core";
import { Result } from "neverthrow";

export interface NotificationOutboundPort {
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
