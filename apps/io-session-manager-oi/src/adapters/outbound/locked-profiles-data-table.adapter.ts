import { odata, TableClient } from "@azure/data-tables";
import {
  TableClientWrapper,
  TableStorageError,
} from "@pagopa/azure-sdk/data-tables";
import {
  BaseError,
  FiscalCode,
  FiscalCodeSchema,
  GenericError,
} from "@pagopa/hexagonal-core";
import { ok, err, Result } from "neverthrow";
import z from "zod";

import { LockedProfilesPort } from "../../domain/ports/outbound/locked-profiles.port.js";

/**
 * Schema for the LockedProfileDataTable entity.
 * This schema is used to validate the structure of the data stored in the Azure Table Storage.
 */
const LockedProfileDataTableSchema = z.object({
  partitionKey: FiscalCodeSchema,
  rowKey: z.string().regex(/^\d{9}$/, "rowKey must be 9 digits"),
  CreatedAt: z.date(),
  Released: z.boolean().optional(),
});

export type LockedProfileDataTable = z.infer<
  typeof LockedProfileDataTableSchema
>;

export class LockedProfilesDataTableAdapter implements LockedProfilesPort {
  private readonly lockedProfilesTableClientWrapper: TableClientWrapper<
    typeof LockedProfileDataTableSchema
  >;

  constructor(lockedProfilesClient: TableClient) {
    this.lockedProfilesTableClientWrapper = new TableClientWrapper(
      lockedProfilesClient,
      LockedProfileDataTableSchema,
    );
  }

  async healthcheck(): Promise<Result<void, GenericError>> {
    try {
      // Minimal reachability probe: request a single page with a filter that
      // matches no entities. This validates network + auth + table existence
      // without transferring any data.
      const iterator = this.lockedProfilesTableClientWrapper
        .getTableClient()
        .listEntities({ queryOptions: { filter: "PartitionKey eq ''" } })
        .byPage({ maxPageSize: 1 });
      await iterator.next();
      return ok(undefined);
    } catch (error) {
      return err(
        new GenericError(
          `Health check failed for LockedProfilesDataTableAdapter: ${error instanceof Error ? error.message : String(error)}`,
        ),
      );
    }
  }

  async isLocked(
    fiscalCode: FiscalCode,
  ): Promise<Result<boolean, TableStorageError | BaseError>> {
    try {
      for await (const entity of this.lockedProfilesTableClientWrapper.listEntities(
        {
          queryOptions: {
            filter: odata`PartitionKey eq ${fiscalCode} and not Released`,
          },
        },
      )) {
        // If there's an error retrieving the entity, return the error
        if (entity.isErr()) {
          return err(entity.error);
        }
        // If we find at least one entity that is not released, the profile is locked
        if (entity.value.entity.Released !== true) {
          return ok(true);
        }
      }

      // If we didn't find any entities that are not released, the profile is not locked
      return ok(false);
    } catch (error) {
      return err(
        new GenericError(
          `Error checking if profile is locked: ${error instanceof Error ? error.message : String(error)}`,
        ),
      );
    }
  }
}
