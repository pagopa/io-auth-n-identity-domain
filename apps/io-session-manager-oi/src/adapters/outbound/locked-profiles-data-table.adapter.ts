import { odata } from "@azure/data-tables";
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
 * Schema for the LockedProfileDataTable data.
 * This schema is used to validate the structure of the data stored in the Azure Table Storage.
 */
const LockedProfileDataTableSchema = z.object({
  partitionKey: FiscalCodeSchema,
  rowKey: z.string().regex(/^\d{9}$/, "rowKey must be 9 digits"),
  CreatedAt: z.coerce.date(),
  Released: z.boolean().optional(),
});

type LockedProfileDataTable = z.infer<
  typeof LockedProfileDataTableSchema
>;

export class LockedProfilesDataTableAdapter implements LockedProfilesPort {
  static readonly schema = LockedProfileDataTableSchema;

  constructor(
    private readonly lockedProfilesTableClientWrapper: TableClientWrapper<
      typeof LockedProfileDataTableSchema
    >,
  ) {}

  async healthcheck(): Promise<Result<void, GenericError>> {
    for await (const entity of this.lockedProfilesTableClientWrapper.listEntities(
      {
        queryOptions: { filter: "PartitionKey eq ''" },
      },
    )) {
      if (entity.isErr()) {
        return err(
          new GenericError(
            `Health check failed for LockedProfilesDataTableAdapter: ${entity.error.message}`,
          ),
        );
      }
      break;
    }
    return ok(undefined);
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
      // Defensive: `listEntities` already converts SDK errors into
      // `yield err(...)`, so this branch should be unreachable. Kept as a
      // safety net for unexpected iterator failures (e.g. bugs in the
      // wrapper or the SDK throwing outside the awaited call).
      return err(
        new GenericError(
          `Error checking if profile is locked: ${error instanceof Error ? error.message : String(error)}`,
        ),
      );
    }
  }
}
