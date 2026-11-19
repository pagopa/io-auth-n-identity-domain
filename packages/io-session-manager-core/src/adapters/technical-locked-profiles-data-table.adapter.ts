import {
  TableClientWrapper,
  TableStorageError,
} from "@pagopa/azure-sdk/data-tables";
import {
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

  async lock(fiscalCode: FiscalCode): Promise<Result<void, TableStorageError>> {
    const result = await this.tableClientWrapper.createEntity({
      partitionKey: fiscalCode,
      rowKey: fiscalCode,
      createdAt: new Date(),
    });
    if (result.isErr()) {
      return err(result.error);
    }
    return ok(undefined);
  }

  async unlock(
    fiscalCode: FiscalCode,
  ): Promise<Result<void, TableStorageError>> {
    const result = await this.tableClientWrapper.deleteEntity(
      fiscalCode,
      fiscalCode,
    );
    if (result.isErr()) {
      return err(result.error);
    }
    return ok(undefined);
  }
}
