import { odata, type TransactionAction } from "@azure/data-tables";
import { TableClientWrapper } from "@pagopa/azure-sdk/data-tables";
import {
  type BaseError,
  type FiscalCode,
  FiscalCodeSchema,
  GenericError,
} from "@pagopa/hexagonal-core";
import { err, ok, type Result } from "neverthrow";
import z from "zod";

import type {
  AuthLockPort,
  NotReleasedAuthenticationLockData,
  UnlockCode,
} from "../../domain/ports/auth-lock.port.js";

export class AuthLockDataTableAdapter
  implements AuthLockPort
{
  static readonly schema = z.object({
    partitionKey: FiscalCodeSchema,
    rowKey: z.string().regex(/^\d{9}$/, "unlockCode must be 9 digits"),
    CreatedAt: z.coerce.date(),
  });

  constructor(
    private readonly tableClientWrapper: TableClientWrapper<
      typeof AuthLockDataTableAdapter.schema
    >,
  ) {}

  async healthcheck(): Promise<Result<void, GenericError>> {
    for await (const entity of this.tableClientWrapper.listEntities({
      queryOptions: { filter: "PartitionKey eq ''" },
    })) {
      if (entity.isErr()) {
        return err(
          new GenericError(
            `Health check failed for AuthenticationLockDataTableAdapter: ${entity.error.message}`,
          ),
        );
      }
      break;
    }
    return ok(undefined);
  }

  async getUserAuthenticationLocks(
    fiscalCode: FiscalCode,
  ): Promise<Result<ReadonlyArray<NotReleasedAuthenticationLockData>, BaseError>> {
    try {
      const locks: NotReleasedAuthenticationLockData[] = [];
      for await (const entity of this.tableClientWrapper.listEntities({
        queryOptions: {
          filter: odata`PartitionKey eq ${fiscalCode} and not Released`,
        },
      })) {
        if (entity.isErr()) {
          return err(entity.error);
        }
        locks.push({
          partitionKey: entity.value.entity.partitionKey,
          rowKey: entity.value.entity.rowKey as UnlockCode,
          CreatedAt: entity.value.entity.CreatedAt,
        });
      }
      return ok(locks);
    } catch (error) {
      return err(
        new GenericError(
          `Error retrieving authentication locks: ${error instanceof Error ? error.message : String(error)}`,
        ),
      );
    }
  }

  async isUserAuthenticationLocked(
    fiscalCode: FiscalCode,
  ): Promise<Result<boolean, BaseError>> {
    const result = await this.getUserAuthenticationLocks(fiscalCode);
    return result.isOk()
      ? ok(result.value.length > 0)
      : err(result.error);
  }

  async lockUserAuthentication(
    fiscalCode: FiscalCode,
    unlockCode: UnlockCode,
  ): Promise<Result<true, BaseError>> {
    const result = await this.tableClientWrapper.createEntity({
      partitionKey: fiscalCode,
      rowKey: unlockCode,
      CreatedAt: new Date(),
    });
    return result.isOk() ? ok(true) : err(result.error);
  }

  async unlockUserAuthentication(
    fiscalCode: FiscalCode,
    unlockCodes: ReadonlyArray<UnlockCode>,
  ): Promise<Result<true, BaseError>> {
    const actions: TransactionAction[] = unlockCodes.map((unlockCode) => [
      "update",
      {
        partitionKey: fiscalCode,
        rowKey: unlockCode,
        Released: true,
      },
    ]);
    try {
      const response =
        await this.tableClientWrapper.getTableClient().submitTransaction(actions);
      return response.status === 202
        ? ok(true)
        : err(new GenericError("Something went wrong updating the record"));
    } catch (error) {
      return err(
        error instanceof Error
          ? new GenericError(error.message)
          : new GenericError(String(error)),
      );
    }
  }
}
