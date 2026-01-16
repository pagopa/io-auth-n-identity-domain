import {
  CreateTableEntityResponse,
  TableClient,
  TableTransactionResponse,
} from "@azure/data-tables";
import { Mock, vi } from "vitest";
import { PagedAsyncIterableIterator } from "@azure/data-tables/dist/index";
import { FiscalCode } from "@pagopa/ts-commons/lib/strings";
import { CustomTableClient } from "@pagopa/azure-storage-data-table-migration-kit";
import { NotReleasedAuthenticationLockData } from "../../repositories/locked-profiles";
import { aFiscalCode } from "../user.mocks";
import { UnlockCode } from "../../generated/fast-login-api/UnlockCode";

export const mockCreateEntity: Mock<
  Parameters<TableClient["createEntity"]>,
  ReturnType<TableClient["createEntity"]>
> = vi.fn().mockImplementation(async () => ({}) as CreateTableEntityResponse);

export const mockSubmitTransaction: Mock<
  Parameters<TableClient["submitTransaction"]>,
  ReturnType<TableClient["submitTransaction"]>
> = vi
  .fn()
  .mockImplementation(
    async () => ({ status: 202 }) as TableTransactionResponse,
  );

export const mockListEntities: Mock<
  Parameters<TableClient["listEntities"]>,
  ReturnType<TableClient["listEntities"]>
> = vi.fn().mockImplementation(noProfileLockedRecordIterator);

export const mockedTableClient = {
  createEntity: mockCreateEntity,
  submitTransaction: mockSubmitTransaction,
  listEntities: mockListEntities,
} as unknown as CustomTableClient;

// --------------------------------
// Data mocks for LockedProfile table storage
// --------------------------------

export const anUnlockCode = "123456789" as UnlockCode;
export const anotherUnlockCode = "987654321" as UnlockCode;

export const aNotReleasedData = {
  partitionKey: aFiscalCode,
  rowKey: anUnlockCode,
  CreatedAt: new Date(2022, 1, 1),
};

export const getLockedProfileIterator = (
  expectedResults: NotReleasedAuthenticationLockData[],
) =>
  (async function* () {
    for (const data of expectedResults) {
      yield data;
    }
  })() as PagedAsyncIterableIterator<
    NotReleasedAuthenticationLockData,
    undefined,
    undefined
  >;
export const profileLockedRecordIterator = async function* () {
  yield aNotReleasedData;
} as PagedAsyncIterableIterator<
  NotReleasedAuthenticationLockData,
  undefined,
  undefined
>;
export async function* noProfileLockedRecordIterator(): ReturnType<
  typeof profileLockedRecordIterator
  // eslint-disable-next-line @typescript-eslint/no-empty-function
> {}
export async function* errorProfileLockedRecordIterator(): ReturnType<
  typeof profileLockedRecordIterator
> {
  // Sonarcloud requires at least one `yield` before `throw` operation
  yield aNotReleasedData;
  throw new Error("an Error");
}
export async function* brokeEntityProfileLockedRecordIterator(): ReturnType<
  typeof profileLockedRecordIterator
> {
  // Sonarcloud requires at least one `yield` before `throw` operation
  yield {
    ...aNotReleasedData,
    partitionKey: "CF" as FiscalCode,
  };
}
