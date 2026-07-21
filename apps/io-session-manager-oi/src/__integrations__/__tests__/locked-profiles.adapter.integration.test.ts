import { odata, TableClient } from "@azure/data-tables";
import {
  TableClientWrapper,
  TableStorageError,
} from "@pagopa/azure-sdk/data-tables";
import {
  FiscalCode,
  FiscalCodeSchema,
  GenericError,
} from "@pagopa/hexagonal-core";
import { ok, Result } from "neverthrow";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import z from "zod";

import {
  LockedProfileDataTable,
  LockedProfileDataTableSchema,
  LockedProfilesDataTableAdapter,
} from "../../adapters/outbound/locked-profiles-data-table.adapter.js";
import { LOCKED_PROFILES_STORAGE_CONNECTION_STRING } from "../env.js";
import {
  LOCK_ID,
  LOCKED_FISCAL_CODE,
  RELEASED_FISCAL_CODE,
  UNKNOWN_FISCAL_CODE,
  uniqueLockedProfilesTableName,
} from "../fixtures/locked-profiles.fixture.js";

// ---------------------------------------------------------------------------
// System under test
// ---------------------------------------------------------------------------

const TABLE_NAME = uniqueLockedProfilesTableName();

const tableClient = TableClient.fromConnectionString(
  LOCKED_PROFILES_STORAGE_CONNECTION_STRING,
  TABLE_NAME,
  { allowInsecureConnection: true },
);

const wrapper = new TableClientWrapper(
  tableClient,
  LockedProfileDataTableSchema,
);

const adapter = new LockedProfilesDataTableAdapter(wrapper);

const LOCKED = FiscalCodeSchema.parse(LOCKED_FISCAL_CODE);
const RELEASED = FiscalCodeSchema.parse(RELEASED_FISCAL_CODE);
const UNKNOWN = FiscalCodeSchema.parse(UNKNOWN_FISCAL_CODE);

// ---------------------------------------------------------------------------
// Extended adapter with entity mapping, as example for future implementations
// ---------------------------------------------------------------------------

const LockedProfileSchema = z.object({
  fiscalCode: FiscalCodeSchema,
  unlockCode: z.string().regex(/^\d{9}$/, "unlockCode must be 9 digits"),
});

type LockedProfile = z.infer<typeof LockedProfileSchema>;

class ExtendedLockedProfilesDataTableAdapter extends LockedProfilesDataTableAdapter {
  async lockProfile(
    fiscalCode: FiscalCode,
    unlockCode: string,
  ): Promise<Result<void, TableStorageError>> {
    // Create a new locked profile entity in the table
    const entity = {
      partitionKey: fiscalCode,
      rowKey: unlockCode,
      CreatedAt: new Date(),
    };

    // Force access to the parent's private `lockedProfilesTableClientWrapper`
    await this["lockedProfilesTableClientWrapper"].createEntity(entity);

    return ok(void 0);
  }

  async unlockProfile(
    fiscalCode: FiscalCode,
    unlockCode: string,
  ): Promise<Result<void, TableStorageError>> {
    // Delete the locked profile entity from the table
    await this["lockedProfilesTableClientWrapper"].patchEntity({
      partitionKey: fiscalCode,
      rowKey: unlockCode,
      Released: true,
    });

    return ok(void 0);
  }

  async getLockIfExists(
    fiscalCode: FiscalCode,
  ): Promise<Result<LockedProfile | null, TableStorageError>> {
    for await (const entity of this[
      "lockedProfilesTableClientWrapper"
    ].listEntities({
      queryOptions: {
        filter: odata`PartitionKey eq ${fiscalCode} and not Released`,
      },
    })) {
      if (entity.isOk()) {
        const data = entity.value.entity;
        return ok(ExtendedLockedProfilesDataTableAdapter.mapper(data));
      }
    }
    return ok(null);
  }

  private static mapper(entity: LockedProfileDataTable): LockedProfile {
    return LockedProfileSchema.parse({
      fiscalCode: entity.partitionKey,
      unlockCode: entity.rowKey,
    });
  }
}

const extendedAdapter = new ExtendedLockedProfilesDataTableAdapter(wrapper);

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe("locked-profiles adapter (integration - Azurite)", () => {
  beforeAll(async () => {
    // Mock the time so the seeded rows have a fixed timestamp, which makes the test deterministic.
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));

    // Provision the table and seed the two lock rows.
    await tableClient.createTable();

    await extendedAdapter.lockProfile(LOCKED, LOCK_ID);

    await extendedAdapter.lockProfile(RELEASED, LOCK_ID);
    await extendedAdapter.unlockProfile(RELEASED, LOCK_ID);
  });

  afterAll(async () => {
    await tableClient.deleteTable().catch(() => undefined);
  });

  it("healthcheck returns ok when the table is reachable", async () => {
    const result = await adapter.healthcheck();

    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toBeUndefined();
  });

  it("isLocked returns ok(true) for a fiscal code with an active lock", async () => {
    const result = await adapter.isLocked(LOCKED);

    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toBe(true);
  });

  it("isLocked returns ok(false) for a fiscal code whose lock was released", async () => {
    const result = await adapter.isLocked(RELEASED);

    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toBe(false);
  });

  it("isLocked returns ok(false) for a fiscal code with no lock row", async () => {
    const result = await adapter.isLocked(UNKNOWN);

    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toBe(false);
  });

  it("healthcheck returns err(GenericError) when the table does not exist", async () => {
    // Point a fresh adapter at a table name that was never provisioned.
    const missingTableClient = TableClient.fromConnectionString(
      LOCKED_PROFILES_STORAGE_CONNECTION_STRING,
      `missing${Date.now()}`,
      { allowInsecureConnection: true },
    );
    const missingTableAdapter = new LockedProfilesDataTableAdapter(
      new TableClientWrapper(missingTableClient, LockedProfileDataTableSchema),
    );

    const result = await missingTableAdapter.healthcheck();

    expect(result.isErr()).toBe(true);
    const error = result._unsafeUnwrapErr();
    expect(error).toBeInstanceOf(GenericError);
    expect(error.message).toContain(
      "Health check failed for LockedProfilesDataTableAdapter",
    );
  });
});
