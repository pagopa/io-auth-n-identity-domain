import {
  CreateTableEntityResponse,
  TableClient,
  TableEntityResult,
  UpdateEntityResponse,
} from "@azure/data-tables";
import {
  AuthenticationError,
  BadGatewayError,
  ConflictError,
  ForbiddenError,
  GatewayTimeoutError,
  GenericError,
  GoneError,
  NotFoundError,
  PreconditionFailedError,
  ServiceUnavailableError,
  TooManyRequestsError,
  UnprocessableEntityError,
  ValidationError,
} from "@pagopa/hexagonal-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import {
  TableClientWrapper,
  TableEntitySchema,
} from "../data-table.wrapper.js";

// ---------------------------------------------------------------------------
// Test schema and fixtures
// ---------------------------------------------------------------------------

const TestRowSchema = z.object({
  partitionKey: z.string(),
  rowKey: z.string(),
  name: z.string(),
  count: z.number().int(),
  active: z.boolean().optional(),
});
type TestRow = z.infer<typeof TestRowSchema>;

const TABLE_NAME = "TestTable";
const PK = "tenant-1";
const RK = "row-1";

// ---------------------------------------------------------------------------
// Mock TableClient factory
// ---------------------------------------------------------------------------

interface MockedClient {
  tableName: string;
  createEntity: ReturnType<typeof vi.fn>;
  updateEntity: ReturnType<typeof vi.fn>;
  listEntities: ReturnType<typeof vi.fn>;
}

const buildMockClient = (): MockedClient => ({
  tableName: TABLE_NAME,
  createEntity: vi.fn(),
  updateEntity: vi.fn(),
  listEntities: vi.fn(),
});

const buildWrapper = (client: MockedClient = buildMockClient()) => ({
  client,
  wrapper: new TableClientWrapper(
    client as unknown as TableClient,
    TestRowSchema,
  ),
});

// ---------------------------------------------------------------------------
// Duck-typed RestError helper (matches wrapper's statusCode check)
// ---------------------------------------------------------------------------

const buildRestError = (
  statusCode: number,
  message = "azure sdk failure",
  code = "SomeCode",
): Error => {
  const error = new Error(message) as Error & {
    statusCode: number;
    code: string;
  };
  error.statusCode = statusCode;
  error.code = code;
  return error;
};

// A stored row exactly as the SDK would return it (with system metadata).
const buildStoredRow = (
  overrides: Partial<Record<string, unknown>> = {},
): TableEntityResult<Record<string, unknown>> =>
  ({
    partitionKey: PK,
    rowKey: RK,
    name: "alpha",
    count: 1,
    active: true,
    etag: 'W/"etag-1"',
    timestamp: "2024-01-01T00:00:00Z",
    ...overrides,
  }) as unknown as TableEntityResult<Record<string, unknown>>;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("TableClientWrapper - constructor", () => {
  it("succeeds with a schema that declares partitionKey and rowKey", () => {
    const client = buildMockClient();
    expect(
      () =>
        new TableClientWrapper(client as unknown as TableClient, TestRowSchema),
    ).not.toThrow();
  });

  it("throws when partitionKey is missing", () => {
    const bad = z.object({
      rowKey: z.string(),
      name: z.string(),
    }) as unknown as TableEntitySchema;
    const client = buildMockClient();
    expect(
      () => new TableClientWrapper(client as unknown as TableClient, bad),
    ).toThrowError(/partitionKey/);
  });

  it("throws when rowKey is missing", () => {
    const bad = z.object({
      partitionKey: z.string(),
      name: z.string(),
    }) as unknown as TableEntitySchema;
    const client = buildMockClient();
    expect(
      () => new TableClientWrapper(client as unknown as TableClient, bad),
    ).toThrowError(/rowKey/);
  });

  it("throws listing every missing key when both keys are missing", () => {
    const bad = z.object({
      name: z.string(),
    }) as unknown as TableEntitySchema;
    const client = buildMockClient();
    expect(
      () => new TableClientWrapper(client as unknown as TableClient, bad),
    ).toThrowError(/partitionKey, rowKey/);
  });
});

describe("TableClientWrapper - getTableClient", () => {
  it("returns the underlying TableClient instance", () => {
    const { wrapper, client } = buildWrapper();
    expect(wrapper.getTableClient()).toBe(client);
  });
});

describe("TableClientWrapper - createEntity", () => {
  beforeEach(() => vi.clearAllMocks());

  it("validates the entity and forwards it to the SDK on success", async () => {
    const { wrapper, client } = buildWrapper();
    const response = {} as CreateTableEntityResponse;
    client.createEntity.mockResolvedValue(response);

    const result = await wrapper.createEntity({
      partitionKey: PK,
      rowKey: RK,
      name: "alpha",
      count: 1,
    });

    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toBe(response);
    expect(client.createEntity).toHaveBeenCalledExactlyOnceWith(
      {
        partitionKey: PK,
        rowKey: RK,
        name: "alpha",
        count: 1,
      },
      undefined,
    );
  });

  it("forwards the SDK options untouched", async () => {
    const { wrapper, client } = buildWrapper();
    client.createEntity.mockResolvedValue({} as CreateTableEntityResponse);
    const opts = { requestOptions: { timeout: 1000 } };

    await wrapper.createEntity(
      { partitionKey: PK, rowKey: RK, name: "n", count: 1 },
      opts,
    );

    expect(client.createEntity).toHaveBeenCalledExactlyOnceWith(
      expect.any(Object),
      opts,
    );
  });

  it("returns ValidationError without calling the SDK when the entity is invalid", async () => {
    const { wrapper, client } = buildWrapper();

    const result = await wrapper.createEntity({
      partitionKey: PK,
      rowKey: RK,
      name: "alpha",
      // @ts-expect-error deliberately invalid
      count: "not-a-number",
    });

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toBeInstanceOf(ValidationError);
    expect(client.createEntity).not.toHaveBeenCalled();
  });

  it("maps an SDK 409 conflict into a ConflictError", async () => {
    const { wrapper, client } = buildWrapper();
    client.createEntity.mockRejectedValue(buildRestError(409, "dup"));

    const result = await wrapper.createEntity({
      partitionKey: PK,
      rowKey: RK,
      name: "alpha",
      count: 1,
    });

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toBeInstanceOf(ConflictError);
    expect(result._unsafeUnwrapErr().message).toContain("createEntity failed");
  });
});

describe("TableClientWrapper - patchEntity", () => {
  beforeEach(() => vi.clearAllMocks());

  it("validates a partial payload and calls the SDK with mode=Merge", async () => {
    const { wrapper, client } = buildWrapper();
    client.updateEntity.mockResolvedValue({} as UpdateEntityResponse);

    const result = await wrapper.patchEntity({
      partitionKey: PK,
      rowKey: RK,
      count: 42,
    });

    expect(result.isOk()).toBe(true);
    expect(client.updateEntity).toHaveBeenCalledExactlyOnceWith(
      {
        partitionKey: PK,
        rowKey: RK,
        count: 42,
      },
      "Merge",
      undefined,
    );
  });

  it("accepts a patch that only carries the keys (no payload changes)", async () => {
    const { wrapper, client } = buildWrapper();
    client.updateEntity.mockResolvedValue({} as UpdateEntityResponse);

    const result = await wrapper.patchEntity({
      partitionKey: PK,
      rowKey: RK,
    });

    expect(result.isOk()).toBe(true);
    expect(client.updateEntity).toHaveBeenCalledExactlyOnceWith(
      { partitionKey: PK, rowKey: RK },
      "Merge",
      undefined,
    );
  });

  it("returns ValidationError when a present payload field has the wrong type", async () => {
    const { wrapper, client } = buildWrapper();

    const result = await wrapper.patchEntity({
      partitionKey: PK,
      rowKey: RK,
      // @ts-expect-error deliberately invalid
      count: "nope",
    });

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toBeInstanceOf(ValidationError);
    expect(client.updateEntity).not.toHaveBeenCalled();
  });

  it("returns ValidationError when a key is missing from the patch", async () => {
    const { wrapper, client } = buildWrapper();

    const result = await wrapper.patchEntity({
      partitionKey: PK,
      count: 1,
    } as unknown as TestRow);

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toBeInstanceOf(ValidationError);
    expect(client.updateEntity).not.toHaveBeenCalled();
  });
});

describe("TableClientWrapper - listEntities", () => {
  beforeEach(() => vi.clearAllMocks());

  // Async-iterator stub matching what the wrapper consumes.
  const buildAsyncIterable = (
    rows: TableEntityResult<Record<string, unknown>>[],
    throwAfter?: number,
  ): AsyncIterable<TableEntityResult<Record<string, unknown>>> => ({
    [Symbol.asyncIterator]: async function* () {
      for (let i = 0; i < rows.length; i++) {
        if (throwAfter !== undefined && i === throwAfter) {
          throw buildRestError(500, "iterator boom", "InternalError");
        }
        yield rows[i]!;
      }
    },
  });

  it("yields validated entities for every returned row", async () => {
    const { wrapper, client } = buildWrapper();
    const rows = [
      buildStoredRow({ rowKey: "row-1", name: "a", count: 1 }),
      buildStoredRow({ rowKey: "row-2", name: "b", count: 2 }),
    ];
    client.listEntities.mockReturnValue(buildAsyncIterable(rows));

    const collected: string[] = [];
    for await (const r of wrapper.listEntities()) {
      expect(r.isOk()).toBe(true);
      collected.push(r._unsafeUnwrap().entity.name);
    }

    expect(collected).toEqual(["a", "b"]);
    expect(client.listEntities).toHaveBeenCalledExactlyOnceWith(undefined);
  });

  it("yields ValidationError for an invalid row and keeps iterating", async () => {
    const { wrapper, client } = buildWrapper();
    const rows = [
      buildStoredRow({ rowKey: "row-1", name: "a", count: 1 }),
      buildStoredRow({ rowKey: "row-bad", count: "not-a-number" }),
      buildStoredRow({ rowKey: "row-3", name: "c", count: 3 }),
    ];
    client.listEntities.mockReturnValue(buildAsyncIterable(rows));

    const results = [];
    for await (const r of wrapper.listEntities()) {
      results.push(r);
    }

    expect(results).toHaveLength(3);
    expect(results[0]!.isOk()).toBe(true);
    expect(results[1]!.isErr()).toBe(true);
    expect(results[1]!._unsafeUnwrapErr()).toBeInstanceOf(ValidationError);
    expect(results[2]!.isOk()).toBe(true);
  });

  it("terminates and yields an err if the underlying iterator throws", async () => {
    const { wrapper, client } = buildWrapper();
    const rows = [
      buildStoredRow({ rowKey: "row-1", name: "a", count: 1 }),
      buildStoredRow({ rowKey: "row-2", name: "b", count: 2 }),
      buildStoredRow({ rowKey: "row-3", name: "c", count: 3 }),
    ];
    client.listEntities.mockReturnValue(buildAsyncIterable(rows, 1));

    const results = [];
    for await (const r of wrapper.listEntities()) {
      results.push(r);
    }

    expect(results).toHaveLength(2);
    expect(results[0]!.isOk()).toBe(true);
    expect(results[1]!.isErr()).toBe(true);
    expect(results[1]!._unsafeUnwrapErr()).toBeInstanceOf(GenericError);
  });

  it("forwards list options to the SDK", async () => {
    const { wrapper, client } = buildWrapper();
    client.listEntities.mockReturnValue(buildAsyncIterable([]));
    const opts = { queryOptions: { filter: "PartitionKey eq 'x'" } };

    // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-empty
    for await (const _ of wrapper.listEntities(opts)) {
    }

    expect(client.listEntities).toHaveBeenCalledExactlyOnceWith(opts);
  });
});

describe("TableClientWrapper - handleError (RestError mapping)", () => {
  beforeEach(() => vi.clearAllMocks());

  // Every `createEntity` call in this suite is meant to fail; validation is
  // guaranteed to pass by using a valid entity, so the SDK mock throw drives
  // the assertion.
  const validEntity = {
    partitionKey: PK,
    rowKey: RK,
    name: "n",
    count: 1,
  };

  const cases: {
    status: number;
    ctor: new (...args: never[]) => Error;
  }[] = [
    { status: 400, ctor: ValidationError },
    { status: 401, ctor: AuthenticationError },
    { status: 403, ctor: ForbiddenError },
    { status: 404, ctor: NotFoundError },
    { status: 409, ctor: ConflictError },
    { status: 410, ctor: GoneError },
    { status: 412, ctor: PreconditionFailedError },
    { status: 422, ctor: UnprocessableEntityError },
    { status: 429, ctor: TooManyRequestsError },
    { status: 502, ctor: BadGatewayError },
    { status: 503, ctor: ServiceUnavailableError },
    { status: 504, ctor: GatewayTimeoutError },
    { status: 418, ctor: GenericError },
  ];

  it.each(cases)(
    "maps RestError with statusCode=$status to $ctor.name",
    async ({ status, ctor }) => {
      const { wrapper, client } = buildWrapper();
      client.createEntity.mockRejectedValue(buildRestError(status));

      const result = await wrapper.createEntity(validEntity);

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toBeInstanceOf(ctor);
    },
  );

  it("wraps a plain Error (no statusCode) into a GenericError", async () => {
    const { wrapper, client } = buildWrapper();
    client.createEntity.mockRejectedValue(new Error("boom"));

    const result = await wrapper.createEntity(validEntity);

    expect(result.isErr()).toBe(true);
    const error = result._unsafeUnwrapErr();
    expect(error).toBeInstanceOf(GenericError);
    expect(error.message).toContain("createEntity failed");
    expect(error.message).toContain("boom");
  });

  it("includes the cause message when the thrown Error has a cause", async () => {
    const { wrapper, client } = buildWrapper();
    const cause = new Error("root cause");
    client.createEntity.mockRejectedValue(new Error("outer", { cause }));

    const result = await wrapper.createEntity(validEntity);

    expect(result.isErr()).toBe(true);
    const error = result._unsafeUnwrapErr();
    expect(error).toBeInstanceOf(GenericError);
    expect(error.message).toContain("Caused by: root cause");
  });

  it("includes a stringified cause when the cause is not an Error", async () => {
    const { wrapper, client } = buildWrapper();
    // Node's Error accepts arbitrary cause values.
    client.createEntity.mockRejectedValue(
      new Error("outer", { cause: "raw-cause" as unknown as Error }),
    );

    const result = await wrapper.createEntity(validEntity);

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().message).toContain("Caused by: raw-cause");
  });

  it("wraps a non-Error throwable into a GenericError", async () => {
    const { wrapper, client } = buildWrapper();
    client.createEntity.mockRejectedValue("string failure");

    const result = await wrapper.createEntity(validEntity);

    expect(result.isErr()).toBe(true);
    const error = result._unsafeUnwrapErr();
    expect(error).toBeInstanceOf(GenericError);
    expect(error.message).toContain("string failure");
  });
});
