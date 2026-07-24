import { TableClientWrapper } from "@pagopa/azure-sdk/data-tables";
import {
  FiscalCodeSchema,
  GenericError,
  NotFoundError,
} from "@pagopa/hexagonal-core";
import { err, ok, Result } from "neverthrow";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  LockedProfileDataTableSchema,
  LockedProfilesDataTableAdapter,
} from "../locked-profiles-data-table.adapter.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const FISCAL_CODE = FiscalCodeSchema.parse("ISPXNB32R82Y766D");
const TABLE_NAME = "lockedprofile01";
const ROW_KEY = "123456789";

// The adapter only calls `listEntities` on the wrapper, so we stub that
// single method and inject the object directly through the constructor —
// no module-level `vi.mock` needed.
const listEntitiesMock = vi.fn();
const wrapperStub = {
  listEntities: listEntitiesMock,
} as unknown as TableClientWrapper<typeof LockedProfileDataTableSchema>;

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

// ---------------------------------------------------------------------------
// healthcheck
// ---------------------------------------------------------------------------

describe("LockedProfilesDataTableAdapter#healthcheck", () => {
  it("returns ok when the wrapper iterator yields nothing", async () => {
    listEntitiesMock.mockReturnValue(asyncIterableOf([]));

    const result = await adapter.healthcheck();

    expect(result.isOk()).toBe(true);
    expect(result).toEqual(ok(undefined));
    expect(listEntitiesMock).toHaveBeenCalledExactlyOnceWith({
      queryOptions: { filter: "PartitionKey eq ''" },
    });
  });

  it("returns ok as soon as the iterator yields a single ok result", async () => {
    // The reachability filter matches nothing in practice, but if the service
    // returned a row we should still treat it as a successful probe.
    listEntitiesMock.mockReturnValue(asyncIterableOf([okEntity()]));

    const result = await adapter.healthcheck();

    expect(result.isOk()).toBe(true);
  });

  it("returns err(GenericError) when the iterator yields an err", async () => {
    listEntitiesMock.mockReturnValue(
      asyncIterableOf([err(new GenericError("azurite down"))]),
    );

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

// ---------------------------------------------------------------------------
// isLocked
// ---------------------------------------------------------------------------

describe("LockedProfilesDataTableAdapter#isLocked", () => {
  it("returns ok(false) when the iterator yields nothing (no locks found)", async () => {
    listEntitiesMock.mockReturnValue(asyncIterableOf([]));

    const result = await adapter.isLocked(FISCAL_CODE);

    expect(result.isOk()).toBe(true);
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

    expect(result.isOk()).toBe(true);
    expect(result).toEqual(ok(true));
  });

  it("returns ok(true) when a lock entity has Released explicitly false", async () => {
    listEntitiesMock.mockReturnValue(
      asyncIterableOf([okEntity({ Released: false })]),
    );

    const result = await adapter.isLocked(FISCAL_CODE);

    expect(result.isOk()).toBe(true);
    expect(result).toEqual(ok(true));
  });

  it("returns the yielded error when the iterator emits an err", async () => {
    const notFound = new NotFoundError(TABLE_NAME, "table missing");
    listEntitiesMock.mockReturnValue(asyncIterableOf([err(notFound)]));

    const result = await adapter.isLocked(FISCAL_CODE);

    expect(result.isErr()).toBe(true);
    const error = result._unsafeUnwrapErr();
    expect (error).toBeInstanceOf(NotFoundError);
    expect(error).toEqual(notFound);
  });

  it("stops iterating on the first err (does not inspect subsequent entities)", async () => {
    const boom = new GenericError("first-error");
    listEntitiesMock.mockReturnValue(
      asyncIterableOf([err(boom), okEntity({ Released: false })]),
    );

    const result = await adapter.isLocked(FISCAL_CODE);

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toBe(boom);
  });

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
