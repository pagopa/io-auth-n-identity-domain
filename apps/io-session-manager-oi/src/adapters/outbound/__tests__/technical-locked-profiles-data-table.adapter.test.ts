import { TableClientWrapper } from "@pagopa/azure-sdk/data-tables";
import {
  FiscalCodeSchema,
  GenericError,
  NotFoundError,
} from "@pagopa/hexagonal-core";
import { err, ok } from "neverthrow";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TechnicalLockedProfilesDataTableAdapter } from "../technical-locked-profiles-data-table.adapter.js";

const FISCAL_CODE = FiscalCodeSchema.parse("ISPXNB32R82Y766D");

const getEntityMock = vi.fn();
const wrapperStub = {
  getEntity: getEntityMock,
} as unknown as TableClientWrapper<
  typeof TechnicalLockedProfilesDataTableAdapter.schema
>;

const adapter = new TechnicalLockedProfilesDataTableAdapter(wrapperStub);

beforeEach(() => {
  vi.clearAllMocks();
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

describe("TechnicalLockedProfilesDataTableAdapter#healthcheck", () => {
  it("returns ok when the sentinel entity is not found", async () => {
    getEntityMock.mockResolvedValue(
      err(new NotFoundError("TechnicalLockedProfiles", "not found")),
    );

    const result = await adapter.healthcheck();

    expect(result).toEqual(ok(undefined));
    expect(getEntityMock).toHaveBeenCalledExactlyOnceWith(
      "__healthcheck__",
      "__healthcheck__",
    );
  });

  it("returns a GenericError when the point lookup fails", async () => {
    getEntityMock.mockResolvedValue(err(new GenericError("table unavailable")));

    const result = await adapter.healthcheck();

    expect(result.isErr()).toBe(true);
    const error = result._unsafeUnwrapErr();
    expect(error).toBeInstanceOf(GenericError);
    expect(error.message).toContain("Health check failed");
    expect(error.message).toContain("table unavailable");
  });
});
