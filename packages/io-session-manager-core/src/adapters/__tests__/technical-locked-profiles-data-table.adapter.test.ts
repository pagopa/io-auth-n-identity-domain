import { TableClientWrapper } from "@pagopa/azure-sdk/data-tables";
import {
  ConflictError,
  FiscalCodeSchema,
  GenericError,
  NotFoundError,
} from "@pagopa/hexagonal-core";
import { err, ok } from "neverthrow";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TechnicalLockedProfilesDataTableAdapter } from "../technical-locked-profiles-data-table.adapter.js";

const FISCAL_CODE = FiscalCodeSchema.parse("ISPXNB32R82Y766D");

const createEntityMock =
  vi.fn<
    TableClientWrapper<
      typeof TechnicalLockedProfilesDataTableAdapter.schema
    >["createEntity"]
  >();
const deleteEntityMock =
  vi.fn<
    TableClientWrapper<
      typeof TechnicalLockedProfilesDataTableAdapter.schema
    >["deleteEntity"]
  >();
const getEntityMock = vi.fn();
const listEntitiesMock = vi.fn();
const wrapperStub = {
  createEntity: createEntityMock,
  deleteEntity: deleteEntityMock,
  getEntity: getEntityMock,
  listEntities: listEntitiesMock,
} as unknown as TableClientWrapper<
  typeof TechnicalLockedProfilesDataTableAdapter.schema
>;

const adapter = new TechnicalLockedProfilesDataTableAdapter(wrapperStub);

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("TechnicalLockedProfilesDataTableAdapter#isLocked", () => {
  it("returns ok(true) when the profile exists", async () => {
    getEntityMock.mockResolvedValue(
      ok({
        entity: {
          partitionKey: FISCAL_CODE,
          rowKey: FISCAL_CODE,
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
        },
        etag: 'W/"etag-1"',
      }),
    );

    const result = await adapter.isLocked(FISCAL_CODE);

    expect(result).toEqual(ok(true));
    expect(getEntityMock).toHaveBeenCalledExactlyOnceWith(
      FISCAL_CODE,
      FISCAL_CODE,
    );
  });

  it("returns ok(false) when the profile does not exist", async () => {
    getEntityMock.mockResolvedValue(
      err(new NotFoundError("TechnicalLockedProfiles", "profile not found")),
    );

    const result = await adapter.isLocked(FISCAL_CODE);

    expect(result).toEqual(ok(false));
  });

  it("propagates storage errors other than NotFoundError", async () => {
    const storageError = new GenericError("table unavailable");
    getEntityMock.mockResolvedValue(err(storageError));

    const result = await adapter.isLocked(FISCAL_CODE);

    expect(result).toEqual(err(storageError));
  });
});

describe("TechnicalLockedProfilesDataTableAdapter#lock", () => {
  it("creates a lock with the fiscal code as both keys and the current timestamp", async () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);
    createEntityMock.mockResolvedValue(ok({}));

    const result = await adapter.lock(FISCAL_CODE);

    expect(result).toEqual(ok(undefined));
    expect(createEntityMock).toHaveBeenCalledExactlyOnceWith({
      partitionKey: FISCAL_CODE,
      rowKey: FISCAL_CODE,
      createdAt: now,
    });
  });

  it.each([
    new ConflictError("profile already locked"),
    new NotFoundError("TechnicalLockedProfiles", "table not found"),
    new GenericError("table unavailable"),
  ])("propagates $kind", async (storageError) => {
    createEntityMock.mockResolvedValue(err(storageError));

    const result = await adapter.lock(FISCAL_CODE);

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toBe(storageError);
  });
});

describe("TechnicalLockedProfilesDataTableAdapter#unlock", () => {
  it("deletes the lock using the fiscal code", async () => {
    deleteEntityMock.mockResolvedValue(ok(undefined));

    const result = await adapter.unlock(FISCAL_CODE);

    expect(result).toEqual(ok(undefined));
    expect(deleteEntityMock).toHaveBeenCalledExactlyOnceWith(
      FISCAL_CODE,
      FISCAL_CODE,
    );
  });

  it.each([
    new NotFoundError("TechnicalLockedProfiles", "lock not found"),
    new GenericError("table unavailable"),
  ])("propagates $kind", async (storageError) => {
    deleteEntityMock.mockResolvedValue(err(storageError));

    const result = await adapter.unlock(FISCAL_CODE);

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toBe(storageError);
  });
});

describe("TechnicalLockedProfilesDataTableAdapter#healthcheck", () => {
  it("returns ok when the wrapper iterator yields nothing", async () => {
    listEntitiesMock.mockReturnValue({
      async *[Symbol.asyncIterator]() {},
    });

    const result = await adapter.healthcheck();

    expect(result).toEqual(ok(undefined));
    expect(listEntitiesMock).toHaveBeenCalledExactlyOnceWith({
      queryOptions: { filter: "PartitionKey eq ''" },
    });
  });

  it("returns ok as soon as the iterator yields a single ok result", async () => {
    listEntitiesMock.mockReturnValue({
      async *[Symbol.asyncIterator]() {
        yield ok({ entity: {}, etag: "etag" });
      },
    });

    const result = await adapter.healthcheck();

    expect(result).toEqual(ok(undefined));
  });

  it("returns a GenericError when the iterator yields an error", async () => {
    listEntitiesMock.mockReturnValue({
      async *[Symbol.asyncIterator]() {
        yield err(new GenericError("table unavailable"));
      },
    });

    const result = await adapter.healthcheck();

    expect(result.isErr()).toBe(true);
    const error = result._unsafeUnwrapErr();
    expect(error).toBeInstanceOf(GenericError);
    expect(error.message).toContain("Health check failed");
    expect(error.message).toContain("table unavailable");
  });
});
