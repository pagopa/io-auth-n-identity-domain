import { TableClient } from "@azure/data-tables";
import {
  ConflictError,
  NonEmptyString,
  NonEmptyStringSchema,
  NotFoundError,
  PreconditionFailedError,
  ValidationError,
} from "@pagopa/hexagonal-core";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

import { TableClientWrapper } from "../../data-table.wrapper.js";
import { STORAGE_CONN_STRING } from "../env.js";

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const Row = z.object({
  partitionKey: NonEmptyStringSchema,
  rowKey: NonEmptyStringSchema,
  name: z.string(),
  count: z.number().int(),
  active: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

// One table per test-run, so parallel CI jobs never collide.
const TABLE_NAME = `test${Date.now()}${Math.floor(
  Math.random() * 1_000,
)}` as NonEmptyString;

const PK = "tenant-1" as NonEmptyString;

const newRowKey = (): NonEmptyString =>
  `row-${crypto.randomUUID().replace(/-/g, "")}` as NonEmptyString;

// ---------------------------------------------------------------------------
// System under test
// ---------------------------------------------------------------------------

// Build the TableClient ourselves so we can enable `allowInsecureConnection`
// (Azurite is served over plain HTTP), then hand it to the wrapper.
const tableClient = TableClient.fromConnectionString(
  STORAGE_CONN_STRING as unknown as string,
  TABLE_NAME as unknown as string,
  { allowInsecureConnection: true },
);

const wrapper: TableClientWrapper<typeof Row> = new TableClientWrapper(tableClient, Row);

// A second TableClient used to create/drop the table without going through
// the wrapper (which doesn't expose table admin operations).
const admin = TableClient.fromConnectionString(
  STORAGE_CONN_STRING as unknown as string,
  TABLE_NAME as unknown as string,
  { allowInsecureConnection: true },
);

describe("TableClientWrapper (integration - Azurite)", () => {
  beforeAll(async () => {
    await admin.createTable();
  });

  afterEach(async () => {
    // Cleanup after each test so we don't have to worry about test isolation.
    await admin
      .listEntities({ queryOptions: { filter: `PartitionKey eq '${PK}'` } })
      .byPage()
      .next()
      .then((page) =>
        page.value?.map((row: { partitionKey: string; rowKey: string }) =>
          admin
            .deleteEntity(row.partitionKey, row.rowKey)
            .catch(() => undefined),
        ),
      );
  });

  afterAll(async () => {
    // Best-effort cleanup; ignore errors so a partial test run still tears
    // down whatever was created.
    await admin.deleteTable().catch(() => undefined);
  });

  it("createEntity works", async () => {
    const rk = newRowKey();
    const create = await wrapper.createEntity({
      partitionKey: PK,
      rowKey: rk,
      name: "alpha",
      count: 1,
      active: true,
    });
    expect(create.isOk()).toBe(true);
    expect(create._unsafeUnwrap()).toBeDefined();
    expect(create._unsafeUnwrap().etag).toBeDefined();
  });

  it("createEntity rejects invalid data with a ValidationError (no service call)", async () => {
    const rk = newRowKey();
    const bad = await wrapper.createEntity({
      partitionKey: PK,
      rowKey: rk,
      name: "x",
      // @ts-expect-error deliberately wrong shape
      count: "not-a-number",
    });
    expect(bad.isErr()).toBe(true);
    expect(bad._unsafeUnwrapErr()).toBeInstanceOf(ValidationError);
  });

  it("createEntity twice on the same key surfaces a ConflictError", async () => {
    const rk = newRowKey();
    await wrapper.createEntity({
      partitionKey: PK,
      rowKey: rk,
      name: "first",
      count: 1,
    });
    const dup = await wrapper.createEntity({
      partitionKey: PK,
      rowKey: rk,
      name: "second",
      count: 2,
    });
    expect(dup.isErr()).toBe(true);
    expect(dup._unsafeUnwrapErr()).toBeInstanceOf(ConflictError);
  });

  it("listEntities yields all seeded rows as validated results", async () => {
    // Seed a small, isolated partition just for this test.
    const listPk = `list-${crypto.randomUUID()}` as NonEmptyString;
    const rows = [
      { rowKey: newRowKey(), name: "a", count: 1 },
      { rowKey: newRowKey(), name: "b", count: 2 },
      { rowKey: newRowKey(), name: "c", count: 3 },
    ];
    for (const r of rows) {
      const c = await wrapper.createEntity({
        partitionKey: listPk,
        rowKey: r.rowKey,
        name: r.name,
        count: r.count,
      });
      expect(c.isOk()).toBe(true);
    }

    const collected: { name: string; count: number }[] = [];
    for await (const r of wrapper.listEntities({
      queryOptions: { filter: `PartitionKey eq '${listPk}'` },
    })) {
      expect(r.isOk()).toBe(true);
      collected.push({
        name: r._unsafeUnwrap().entity.name,
        count: r._unsafeUnwrap().entity.count,
      });
    }

    expect(collected).toHaveLength(rows.length);
    expect(collected.map((c) => c.name).sort()).toEqual(["a", "b", "c"]);
  });
});
