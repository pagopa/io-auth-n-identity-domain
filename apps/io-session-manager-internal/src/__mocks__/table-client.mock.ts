import { CreateTableEntityResponse, TableClient } from "@azure/data-tables";
import { vi } from "vitest";
import { FiscalCode } from "@pagopa/ts-commons/lib/strings";
import { NotReleasedAuthenticationLockData } from "../repositories/auth-lock";
import { aFiscalCode, anUnlockCode } from "./user.mock";

export const mockListEntities = vi
  .fn()
  .mockImplementation(noProfileLockedRecordIterator);

export const mockCreateEntity = vi
  .fn()
  .mockResolvedValue({} as CreateTableEntityResponse);

export const mockTableClient = {
  listEntities: mockListEntities,
  createEntity: mockCreateEntity,
} as unknown as TableClient;

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
