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
  NotFoundError,
} from "@pagopa/hexagonal-core";
import { err, ok, Result } from "neverthrow";
import z from "zod";

import { LockedProfilesPort } from "../../domain/ports/outbound/locked-profiles.port.js";

const HEALTHCHECK_KEY = "__healthcheck__";

export class LockedProfilesDataTableAdapter implements LockedProfilesPort {
  static readonly schema = z.object({
    partitionKey: FiscalCodeSchema,
    rowKey: z.string().regex(/^\d{9}$/, "unlockCode must be 9 digits"), // UnlockCode
    CreatedAt: z.coerce.date(),
    Released: z.boolean().optional(),
  });

  constructor(
    private readonly lockedProfilesTableClientWrapper: TableClientWrapper<
      typeof LockedProfilesDataTableAdapter.schema
    >,
  ) {}

  async healthcheck(): Promise<Result<void, GenericError>> {
    const result = await this.lockedProfilesTableClientWrapper.getEntity(
      HEALTHCHECK_KEY,
      HEALTHCHECK_KEY,
    );
    if (result.isErr() && !(result.error instanceof NotFoundError)) {
      return err(
        new GenericError(
          `Health check failed for LockedProfilesDataTableAdapter: ${result.error.message}`,
        ),
      );
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

        return ok(true);
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
