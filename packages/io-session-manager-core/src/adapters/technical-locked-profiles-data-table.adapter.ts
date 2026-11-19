import {
  TableClientWrapper,
  TableStorageError,
} from "@pagopa/azure-sdk/data-tables";
import {
  ConflictError,
  FiscalCode,
  FiscalCodeSchema,
  GenericError,
  NotFoundError,
} from "@pagopa/hexagonal-core";
import { HealthCheckOutboundPort } from "@pagopa/io-auth-n-identity-domain";
import { err, ok, Result } from "neverthrow";
import z from "zod";

import { TechnicalLockedProfilesPort } from "../domain/ports/technical-locked-profiles.port.js";

export class TechnicalLockedProfilesDataTableAdapter
  implements TechnicalLockedProfilesPort, HealthCheckOutboundPort
{
  static readonly schema = z.object({
    partitionKey: FiscalCodeSchema,
    rowKey: FiscalCodeSchema,
    createdAt: z.coerce.date(),
  });

  constructor(
    private readonly tableClientWrapper: TableClientWrapper<
      typeof TechnicalLockedProfilesDataTableAdapter.schema
    >,
  ) {}

  async healthcheck(): Promise<Result<void, GenericError>> {
    for await (const entity of this.tableClientWrapper.listEntities({
      queryOptions: { filter: "PartitionKey eq ''" },
    })) {
      if (entity.isErr()) {
        return err(
          new GenericError(
            `Health check failed for ${TechnicalLockedProfilesDataTableAdapter.name}: ${entity.error.message}`,
          ),
        );
      }
      break;
    }
    return ok(undefined);
  }

  /**
   * Checks if a user's session is locked by looking up the entry in the technical locked profiles table.
   *
   * @param fiscalCode The fiscal code of the user to check.
   * @returns A result indicating whether the user's session is locked or not.
   */
  async isLocked(
    fiscalCode: FiscalCode,
  ): Promise<Result<boolean, Exclude<TableStorageError, NotFoundError>>> {
    const maybeEntity = await this.tableClientWrapper.getEntity(
      fiscalCode,
      fiscalCode,
    );
    if (maybeEntity.isErr()) {
      if (maybeEntity.error instanceof NotFoundError) {
        return ok(false);
      }
      return err(maybeEntity.error);
    }
    return ok(true);
  }

  /**
   * Locks a user's session by creating an entry in the technical locked profiles table.
   * If the profile is already locked, the operation succeeds without error.
   *
   * @param fiscalCode The fiscal code of the user to lock.
   * @returns A result indicating success or failure of the lock operation.
   */
  async lock(fiscalCode: FiscalCode): Promise<Result<void, TableStorageError>> {
    const result = await this.tableClientWrapper.createEntity({
      partitionKey: fiscalCode,
      rowKey: fiscalCode,
      createdAt: new Date(),
    });
    if (result.isErr()) {
      if (result.error instanceof ConflictError) {
        return ok(undefined);
      }
      return err(result.error);
    }
    return ok(undefined);
  }

  /**
   * Unlocks a user's session by deleting the entry in the technical locked profiles table.
   * If the profile is not locked, the operation succeeds without error.
   *
   * @param fiscalCode The fiscal code of the user to unlock.
   * @returns A result indicating success or failure of the unlock operation.
   */
  async unlock(
    fiscalCode: FiscalCode,
  ): Promise<Result<void, TableStorageError>> {
    const result = await this.tableClientWrapper.deleteEntity(
      fiscalCode,
      fiscalCode,
    );
    if (result.isErr()) {
      if (result.error instanceof NotFoundError) {
        return ok(undefined);
      }
      return err(result.error);
    }
    return ok(undefined);
  }
}
