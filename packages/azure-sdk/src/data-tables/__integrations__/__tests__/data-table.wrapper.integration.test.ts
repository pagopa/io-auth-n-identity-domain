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

const wrapper = new TableClientWrapper(tableClient, Row);

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

  it("createEntity + getEntity round-trip returns the validated entity and metadata", async () => {
    const rk = newRowKey();
    const create = await wrapper.createEntity({
      partitionKey: PK,
      rowKey: rk,
      name: "alpha",
      count: 1,
      active: true,
    });
    expect(create.isOk()).toBe(true);

    const read = await wrapper.getEntity(PK, rk);
    expect(read.isOk()).toBe(true);

    const row = read._unsafeUnwrap();
    expect(row.entity).toEqual({
      partitionKey: PK,
      rowKey: rk,
      name: "alpha",
      count: 1,
      active: true,
    });
    expect(typeof row.etag).toBe("string");
    expect(row.etag.length).toBeGreaterThan(0);
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

    // Confirm nothing was persisted.
    const read = await wrapper.getEntity(PK, rk);
    expect(read.isErr()).toBe(true);
    expect(read._unsafeUnwrapErr()).toBeInstanceOf(NotFoundError);
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

  it("getEntity for a missing row returns a NotFoundError carrying the configured entityName", async () => {
    const read = await wrapper.getEntity(PK, newRowKey());
    expect(read.isErr()).toBe(true);
    const error = read._unsafeUnwrapErr();
    expect(error).toBeInstanceOf(NotFoundError);
    expect((error as NotFoundError).entityName).toBe("TestEntity");
  });

  it("updateEntity (Replace) drops fields not present in the new payload", async () => {
    const rk = newRowKey();
    await wrapper.createEntity({
      partitionKey: PK,
      rowKey: rk,
      name: "before",
      count: 1,
      active: true,
    });

    const updated = await wrapper.updateEntity({
      partitionKey: PK,
      rowKey: rk,
      name: "after",
      count: 2,
      // no `active`
    });
    expect(updated.isOk()).toBe(true);

    const read = await wrapper.getEntity(PK, rk);
    expect(read.isOk()).toBe(true);
    expect(read._unsafeUnwrap().entity).toEqual({
      partitionKey: PK,
      rowKey: rk,
      name: "after",
      count: 2,
    });
  });

  it("patchEntity (Merge) preserves fields absent from the patch", async () => {
    const rk = newRowKey();
    await wrapper.createEntity({
      partitionKey: PK,
      rowKey: rk,
      name: "seed",
      count: 10,
      active: true,
    });

    const patched = await wrapper.patchEntity({
      partitionKey: PK,
      rowKey: rk,
      count: 11,
    });
    expect(patched.isOk()).toBe(true);

    const read = await wrapper.getEntity(PK, rk);
    expect(read.isOk()).toBe(true);
    expect(read._unsafeUnwrap().entity).toEqual({
      partitionKey: PK,
      rowKey: rk,
      name: "seed",
      count: 11,
      active: true,
    });
  });

  it("upsertEntity inserts when missing and replaces when present", async () => {
    const rk = newRowKey();

    // Insert
    const inserted = await wrapper.upsertEntity({
      partitionKey: PK,
      rowKey: rk,
      name: "insert",
      count: 1,
    });
    expect(inserted.isOk()).toBe(true);

    // Replace
    const replaced = await wrapper.upsertEntity({
      partitionKey: PK,
      rowKey: rk,
      name: "replace",
      count: 2,
      active: false,
    });
    expect(replaced.isOk()).toBe(true);

    const read = await wrapper.getEntity(PK, rk);
    expect(read._unsafeUnwrap().entity).toEqual({
      partitionKey: PK,
      rowKey: rk,
      name: "replace",
      count: 2,
      active: false,
    });
  });

  it("etag-conditioned updateEntity yields PreconditionFailedError when the etag is stale", async () => {
    const rk = newRowKey();
    await wrapper.createEntity({
      partitionKey: PK,
      rowKey: rk,
      name: "concurrent",
      count: 1,
    });

    const read = await wrapper.getEntity(PK, rk);
    const staleEtag = read._unsafeUnwrap().etag;

    // Update once to bump the etag on the server.
    await wrapper.updateEntity({
      partitionKey: PK,
      rowKey: rk,
      name: "concurrent",
      count: 2,
    });

    // Conditional update with the (now stale) etag must fail.
    const conflict = await wrapper.updateEntity(
      {
        partitionKey: PK,
        rowKey: rk,
        name: "concurrent",
        count: 3,
      },
      { etag: staleEtag },
    );
    expect(conflict.isErr()).toBe(true);
    expect(conflict._unsafeUnwrapErr()).toBeInstanceOf(PreconditionFailedError);
  });

  it("deleteEntity removes the row and a subsequent getEntity returns NotFoundError", async () => {
    const rk = newRowKey();
    await wrapper.createEntity({
      partitionKey: PK,
      rowKey: rk,
      name: "todelete",
      count: 0,
    });

    const deleted = await wrapper.deleteEntity(PK, rk);
    expect(deleted.isOk()).toBe(true);

    const read = await wrapper.getEntity(PK, rk);
    expect(read.isErr()).toBe(true);
    expect(read._unsafeUnwrapErr()).toBeInstanceOf(NotFoundError);
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
