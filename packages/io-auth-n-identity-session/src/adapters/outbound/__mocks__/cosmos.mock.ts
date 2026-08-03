import {
  Container,
  CosmosClient,
  Database,
  ErrorResponse,
  Item,
} from "@azure/cosmos";
import { vi } from "vitest";

type MockFn = ReturnType<typeof vi.fn>;

export interface ContainerMock {
  itemMock: { read: MockFn; delete: MockFn };
  item: MockFn;
  create: MockFn;
  batch: MockFn;
  bulk: MockFn;
  fetchAll: MockFn;
  query: MockFn;
  container: Container;
}

export function makeContainerMock(): ContainerMock {
  const itemMock = { read: vi.fn(), delete: vi.fn() };
  const item = vi.fn(() => itemMock as unknown as Item);
  const create = vi.fn();
  const batch = vi.fn();
  const bulk = vi.fn();
  const fetchAll = vi.fn();
  const query = vi.fn(() => ({ fetchAll }));

  const container = {
    item,
    items: { create, batch, bulk, query },
  } as unknown as Container;

  return {
    itemMock,
    item,
    create,
    batch,
    bulk,
    fetchAll,
    query,
    container,
  };
}

export function makeClientMock(
  resolveContainer: (id: string) => ContainerMock,
): CosmosClient {
  // `Database.container(id)` is a method returning the Container instance.
  const database = {
    container: vi.fn((id: string) => resolveContainer(id).container),
  } as unknown as Database;
  return {
    database: vi.fn(() => database),
  } as unknown as CosmosClient;
}

export function makeErrorResponse(code: number): ErrorResponse {
  const e = new ErrorResponse(`cosmos error ${code}`);
  e.code = code;
  return e;
}
