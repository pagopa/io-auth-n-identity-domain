import { TableClient } from "@azure/data-tables";
import { Mock, vi } from "vitest";

export const mockCreateEntity: Mock<
  Parameters<TableClient["createEntity"]>,
  ReturnType<TableClient["createEntity"]>
> = vi.fn();

export const mockSubmitTransaction: Mock<
  Parameters<TableClient["submitTransaction"]>,
  ReturnType<TableClient["submitTransaction"]>
> = vi.fn();

export const mockListEntities: Mock<
  Parameters<TableClient["listEntities"]>,
  ReturnType<TableClient["listEntities"]>
> = vi.fn();

export const mockedTableClient = {
  createEntity: mockCreateEntity,
  submitTransaction: mockSubmitTransaction,
  listEntities: mockListEntities,
} as unknown as TableClient;
