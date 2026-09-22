import { TableClientWrapper } from "@pagopa/azure-sdk/data-tables";
import {
  FiscalCodeSchema,
  GenericError,
  NotFoundError,
} from "@pagopa/hexagonal-core";
import { err, ok, Result } from "neverthrow";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LockedProfilesDataTableAdapter } from "../locked-profiles-data-table.adapter.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const FISCAL_CODE = FiscalCodeSchema.parse("ISPXNB32R82Y766D");
const TABLE_NAME = "lockedprofile01";
const ROW_KEY = "123456789";

const getEntityMock = vi.fn();
const listEntitiesMock = vi.fn();
const wrapperStub = {
  getEntity: getEntityMock,
  listEntities: listEntitiesMock,
} as unknown as TableClientWrapper<
  typeof LockedProfilesDataTableAdapter.schema
>;

const adapter = new LockedProfilesDataTableAdapter(wrapperStub);

// Async iterable helper mirroring the wrapper's `listEntities` return shape.
type ListYield = Result<
  {
    entity: {
      partitionKey: string;
      rowKey: string;
      CreatedAt: Date;
      Released?: boolean;
    };
    etag: string;
    timestamp?: string;
  },
  Error
>;

const asyncIterableOf = (values: ListYield[]): AsyncIterable<ListYield> => ({
  async *[Symbol.asyncIterator]() {
    for (const value of values) {
      yield value;
    }
  },
});

const asyncIterableThatThrows = (error: unknown): AsyncIterable<ListYield> => ({
  async *[Symbol.asyncIterator]() {
    throw error;
  },
});

const okEntity = (
  overrides: Partial<{
    partitionKey: string;
    rowKey: string;
    CreatedAt: Date;
    Released?: boolean;
  }> = {},
): ListYield =>
  ok({
    entity: {
      partitionKey: FISCAL_CODE,
      rowKey: ROW_KEY,
      CreatedAt: new Date("2026-01-01T00:00:00.000Z"),
      ...overrides,
    },
    etag: 'W/"etag-1"',
    timestamp: "2026-01-01T00:00:00Z",
  });

beforeEach(() => {
  vi.clearAllMocks();
});

describe("LockedProfilesDataTableAdapter#healthcheck", () => {
  it("returns ok when the sentinel entity is not found", async () => {
    getEntityMock.mockResolvedValue(
      err(new NotFoundError("LockedProfiles", "not found")),
    );

    const result = await adapter.healthcheck();

    expect(result).toEqual(ok(undefined));
    expect(getEntityMock).toHaveBeenCalledExactlyOnceWith(
      "__healthcheck__",
      "__healthcheck__",
    );
  });

  it("returns a GenericError when the point lookup fails", async () => {
    getEntityMock.mockResolvedValue(err(new GenericError("azurite down")));

    const result = await adapter.healthcheck();

    expect(result.isErr()).toBe(true);
    const error = result._unsafeUnwrapErr();
    expect(error).toBeInstanceOf(GenericError);
    expect(error.message).toContain(
      "Health check failed for LockedProfilesDataTableAdapter",
    );
    expect(error.message).toContain("azurite down");
  });
});

describe("LockedProfilesDataTableAdapter#isLocked", () => {
  it("returns ok(false) when the iterator yields nothing (no locks found)", async () => {
    listEntitiesMock.mockReturnValue(asyncIterableOf([]));

    const result = await adapter.isLocked(FISCAL_CODE);

    expect(result).toEqual(ok(false));
    expect(listEntitiesMock).toHaveBeenCalledExactlyOnceWith({
      queryOptions: {
        filter: `PartitionKey eq '${FISCAL_CODE}' and not Released`,
      },
    });
  });

  it("returns ok(true) when a lock entity has Released !== true", async () => {
    listEntitiesMock.mockReturnValue(
      asyncIterableOf([okEntity({ Released: undefined })]),
    );

    const result = await adapter.isLocked(FISCAL_CODE);

    expect(result).toEqual(ok(true));
  });

  it("returns ok(true) when a lock entity has Released explicitly false", async () => {
    listEntitiesMock.mockReturnValue(
      asyncIterableOf([okEntity({ Released: false })]),
    );

    const result = await adapter.isLocked(FISCAL_CODE);

    expect(result).toEqual(ok(true));
  });

  it("returns the yielded error when the iterator emits an err", async () => {
    const notFound = new NotFoundError(TABLE_NAME, "table missing");
    listEntitiesMock.mockReturnValue(asyncIterableOf([err(notFound)]));

    const result = await adapter.isLocked(FISCAL_CODE);

    expect(result.isErr()).toBe(true);
    const error = result._unsafeUnwrapErr();
    expect(error).toBeInstanceOf(NotFoundError);
    expect(error).toEqual(notFound);
  });

  it.each([
    {
      case: "error",
      entities: asyncIterableOf([
        err(new GenericError("some error")),
        okEntity({ Released: false }),
      ]),
      expected: err(new GenericError("some error")),
    },
    {
      case: "locked",
      entities: asyncIterableOf([
        okEntity({ Released: false }),
        okEntity({ Released: false }),
        err(new GenericError("some error")),
      ]),
      expected: ok(true),
    },
  ] as const)(
    "stops iterating on the first $case (does not inspect subsequent entities)",
    async ({ entities, expected }) => {
      listEntitiesMock.mockReturnValue(entities);

      const result = await adapter.isLocked(FISCAL_CODE);

      expect(result).toEqual(expected);
    },
  );

  it("falls back to GenericError when the iterator itself throws (defensive branch)", async () => {
    listEntitiesMock.mockReturnValue(
      asyncIterableThatThrows(new Error("iterator boom")),
    );

    const result = await adapter.isLocked(FISCAL_CODE);

    expect(result.isErr()).toBe(true);
    const error = result._unsafeUnwrapErr();
    expect(error).toBeInstanceOf(GenericError);
    expect(error.message).toContain("Error checking if profile is locked");
    expect(error.message).toContain("iterator boom");
  });

  it("stringifies non-Error throwables in the defensive branch", async () => {
    listEntitiesMock.mockReturnValue(
      asyncIterableThatThrows("raw string failure"),
    );

    const result = await adapter.isLocked(FISCAL_CODE);

    expect(result.isErr()).toBe(true);
    const error = result._unsafeUnwrapErr();
    expect(error).toBeInstanceOf(GenericError);
    expect(error.message).toContain("raw string failure");
  });
});
