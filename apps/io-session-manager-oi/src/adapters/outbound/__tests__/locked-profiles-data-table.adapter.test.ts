import { TableClient } from "@azure/data-tables";
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
// Module mocks
// ---------------------------------------------------------------------------

const { listEntitiesMock } = vi.hoisted(() => ({
  listEntitiesMock: vi.fn(),
}));

vi.mock("@pagopa/azure-sdk/data-tables", () => ({
  TableClientWrapper: vi.fn().mockImplementation(() => ({
    listEntities: listEntitiesMock,
  })),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const FISCAL_CODE = FiscalCodeSchema.parse("ISPXNB32R82Y766D");
const TABLE_NAME = "lockedprofile01";
const ROW_KEY = "123456789";

const tableClientStub = {
  tableName: TABLE_NAME,
} as unknown as TableClient;

const buildAdapter = () => new LockedProfilesDataTableAdapter(tableClientStub);

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

// ---------------------------------------------------------------------------
// Constructor
// ---------------------------------------------------------------------------

describe("LockedProfilesDataTableAdapter - constructor", () => {
  it("wraps the provided TableClient in a TableClientWrapper", () => {
    buildAdapter();

    expect(TableClientWrapper).toHaveBeenCalledTimes(1);
    expect(TableClientWrapper).toHaveBeenCalledWith(
      tableClientStub,
      expect.any(Object),
    );
  });
});

// ---------------------------------------------------------------------------
// healthcheck
// ---------------------------------------------------------------------------

describe("LockedProfilesDataTableAdapter#healthcheck", () => {
  it("returns ok when the wrapper iterator yields nothing", async () => {
    listEntitiesMock.mockReturnValue(asyncIterableOf([]));

    const result = await buildAdapter().healthcheck();

    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toBeUndefined();
    expect(listEntitiesMock).toHaveBeenCalledExactlyOnceWith({
      queryOptions: { filter: "PartitionKey eq ''" },
    });
  });

  it("returns ok as soon as the iterator yields a single ok result", async () => {
    // The reachability filter matches nothing in practice, but if the service
    // returned a row we should still treat it as a successful probe.
    listEntitiesMock.mockReturnValue(asyncIterableOf([okEntity()]));

    const result = await buildAdapter().healthcheck();

    expect(result.isOk()).toBe(true);
  });

  it("returns err(GenericError) when the iterator yields an err", async () => {
    listEntitiesMock.mockReturnValue(
      asyncIterableOf([err(new GenericError("azurite down"))]),
    );

    const result = await buildAdapter().healthcheck();

    expect(result.isErr()).toBe(true);
    const error = result._unsafeUnwrapErr();
    expect(error).toBeInstanceOf(GenericError);
    expect(error.message).toContain(
      "Health check failed for LockedProfilesDataTableAdapter",
    );
    expect(error.message).toContain("azurite down");
  });
});

// ---------------------------------------------------------------------------
// isLocked
// ---------------------------------------------------------------------------

describe("LockedProfilesDataTableAdapter#isLocked", () => {
  it("returns ok(false) when the iterator yields nothing (no locks found)", async () => {
    listEntitiesMock.mockReturnValue(asyncIterableOf([]));

    const result = await buildAdapter().isLocked(FISCAL_CODE);

    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toBe(false);
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

    const result = await buildAdapter().isLocked(FISCAL_CODE);

    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toBe(true);
  });

  it("returns ok(true) when a lock entity has Released explicitly false", async () => {
    listEntitiesMock.mockReturnValue(
      asyncIterableOf([okEntity({ Released: false })]),
    );

    const result = await buildAdapter().isLocked(FISCAL_CODE);

    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toBe(true);
  });

  it("skips entities where Released === true and returns ok(false) if none remain", async () => {
    // Defensive: the OData filter already excludes released rows, but if a
    // released row leaks through the adapter must not report it as a lock.
    listEntitiesMock.mockReturnValue(
      asyncIterableOf([okEntity({ Released: true })]),
    );

    const result = await buildAdapter().isLocked(FISCAL_CODE);

    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toBe(false);
  });

  it("returns ok(true) when a non-released entity follows a released one", async () => {
    listEntitiesMock.mockReturnValue(
      asyncIterableOf([
        okEntity({ Released: true, rowKey: "111111111" }),
        okEntity({ Released: false, rowKey: "222222222" }),
      ]),
    );

    const result = await buildAdapter().isLocked(FISCAL_CODE);

    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toBe(true);
  });

  it("returns the yielded error when the iterator emits an err", async () => {
    const notFound = new NotFoundError(TABLE_NAME, "table missing");
    listEntitiesMock.mockReturnValue(asyncIterableOf([err(notFound)]));

    const result = await buildAdapter().isLocked(FISCAL_CODE);

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toBe(notFound);
  });

  it("stops iterating on the first err (does not inspect subsequent entities)", async () => {
    const boom = new GenericError("first-error");
    listEntitiesMock.mockReturnValue(
      asyncIterableOf([err(boom), okEntity({ Released: false })]),
    );

    const result = await buildAdapter().isLocked(FISCAL_CODE);

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toBe(boom);
  });

  it("falls back to GenericError when the iterator itself throws (defensive branch)", async () => {
    listEntitiesMock.mockReturnValue(
      asyncIterableThatThrows(new Error("iterator boom")),
    );

    const result = await buildAdapter().isLocked(FISCAL_CODE);

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

    const result = await buildAdapter().isLocked(FISCAL_CODE);

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().message).toContain("raw string failure");
  });
});
