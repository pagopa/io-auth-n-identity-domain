import { odata } from "@azure/data-tables";
import {
  TableClientWrapper,
  TableStorageError,
} from "@pagopa/azure-sdk/data-tables";
import {
  BaseError,
  FiscalCode,
  FiscalCodeSchema,
  ForbiddenError,
  GenericError,
} from "@pagopa/hexagonal-core";
import { err, ok, Result } from "neverthrow";
import z from "zod";

import { type UnlockCode, UnlockCodeSchema } from "../domain/index.js";
import { LockedProfilesPort } from "../domain/ports/locked-profiles.port.js";

export class LockedProfilesDataTableAdapter implements LockedProfilesPort {
  static readonly schema = z.object({
    partitionKey: FiscalCodeSchema,
    rowKey: UnlockCodeSchema,
    CreatedAt: z.coerce.date(),
    Released: z.boolean().optional(),
  });

  constructor(
    private readonly lockedProfilesTableClientWrapper: TableClientWrapper<
      typeof LockedProfilesDataTableAdapter.schema
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

  async lock(
    fiscalCode: FiscalCode,
    unlockCode: UnlockCode,
  ): Promise<Result<void, TableStorageError | BaseError>> {
    const entity = {
      partitionKey: fiscalCode,
      rowKey: unlockCode,
      CreatedAt: new Date(),
    };

    const result =
      await this.lockedProfilesTableClientWrapper.createEntity(entity);

    if (result.isErr()) {
      return err(result.error);
    }

    return ok(undefined);
  }

  async unlock(
    fiscalCode: FiscalCode,
    unlockCode?: UnlockCode,
  ): Promise<Result<void, TableStorageError | BaseError>> {
    const getuUnreleasedLockCodesResult =
      await this.getUnreleasedLockCodes(fiscalCode);
    if (getuUnreleasedLockCodesResult.isErr()) {
      return err(getuUnreleasedLockCodesResult.error);
    }
    const unreleasedLockCodes = getuUnreleasedLockCodesResult.value;

    if (unreleasedLockCodes.length === 0) {
      return ok(undefined);
    }

    if (unlockCode === undefined) {
      return this.releaseLocks(fiscalCode, unreleasedLockCodes);
    }

    if (!unreleasedLockCodes.includes(unlockCode)) {
      return err(new ForbiddenError());
    }
    return this.releaseLocks(fiscalCode, [unlockCode]);
  }

  private async getUnreleasedLockCodes(
    fiscalCode: FiscalCode,
  ): Promise<Result<UnlockCode[], TableStorageError | BaseError>> {
    const keys: UnlockCode[] = [];
    for await (const item of this.lockedProfilesTableClientWrapper.listEntities(
      {
        queryOptions: {
          filter: odata`PartitionKey eq ${fiscalCode} and not Released`,
        },
      },
    )) {
      if (item.isErr()) {
        return err(item.error);
      }
      keys.push(item.value.entity.rowKey);
    }
    return ok(keys);
  }

  private async releaseLocks(
    fiscalCode: FiscalCode,
    unlockCodes: UnlockCode[],
  ): Promise<Result<void, TableStorageError | BaseError>> {
    const result =
      await this.lockedProfilesTableClientWrapper.patchEntitiesTransactionally(
        unlockCodes.map((unlockCode) => ({
          partitionKey: fiscalCode,
          rowKey: unlockCode,
          Released: true,
        })),
      );
    if (result.isErr()) {
      return err(result.error);
    }

    return ok(undefined);
  }
}
