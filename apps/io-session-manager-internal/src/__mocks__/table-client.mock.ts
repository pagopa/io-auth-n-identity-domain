import {
  CreateTableEntityResponse,
  TableClient,
  TableTransactionResponse,
} from "@azure/data-tables";
import { vi } from "vitest";
import { FiscalCode } from "@pagopa/ts-commons/lib/strings";
import { CustomTableClient } from "@pagopa/azure-storage-data-table-migration-kit";
import { NotReleasedAuthenticationLockData } from "../repositories/auth-lock";
import { aFiscalCode, anUnlockCode } from "./user.mock";

export const mockListEntities = vi
  .fn()
  .mockImplementation(noProfileLockedRecordIterator);

export const mockCreateEntityMigrationKit = vi
  .fn()
  .mockRejectedValue(new Error("Should not be called"));

export const mockCreateEntity = vi
  .fn()
  .mockResolvedValue({} as CreateTableEntityResponse);

export const mockSubmitTransaction = vi.fn(
  async () => ({ status: 202 }) as TableTransactionResponse,
);

export const mockTableClient = {
  createEntity: mockCreateEntity,
} as unknown as TableClient;

export const mockTableClientMigrationKit = {
  listEntities: mockListEntities,
  createEntity: mockCreateEntityMigrationKit,
  submitTransaction: mockSubmitTransaction,
} as unknown as CustomTableClient;

export const getLockedProfileIterator = (
  expectedResults: NotReleasedAuthenticationLockData[],
) =>
  (async function* () {
    for (const data of expectedResults) {
      yield data;
    }
  })();

export const aNotReleasedData = {
  partitionKey: aFiscalCode,
  rowKey: anUnlockCode,
  CreatedAt: new Date(2022, 1, 1),
};

export const profileLockedRecordIterator = async function* () {
  yield aNotReleasedData;
};

export async function* noProfileLockedRecordIterator(): ReturnType<
  typeof profileLockedRecordIterator
  // eslint-disable-next-line @typescript-eslint/no-empty-function
> {}

export async function* brokeEntityProfileLockedRecordIterator(): ReturnType<
  typeof profileLockedRecordIterator
> {
  // Sonarcloud requires at least one `yield` before `throw` operation
  yield {
    ...aNotReleasedData,
    partitionKey: "CF" as FiscalCode,
  };
}

export async function* errorProfileLockedRecordIterator(): ReturnType<
  typeof profileLockedRecordIterator
> {
  // Sonarcloud requires at least one `yield` before `throw` operation
  yield aNotReleasedData;
  throw new Error("an Error");
}
