import { CosmosClient, ErrorResponse } from "@azure/cosmos";
import {
  ConflictError,
  GenericError,
  NotFoundError,
} from "@pagopa/hexagonal-core";
import type { FiscalCode } from "@pagopa/hexagonal-core";
import type { LollipopAssertionRef } from "@pagopa/io-auth-n-identity-domain";
import { err, ok } from "neverthrow";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LollipopActivationCosmosAdapter } from "../lollipop-activation-cosmos.adapter.js";
import type { LollipopActivation } from "../../../domain/entities/lollipop-activation.entity.js";

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const LOLLIPOP_CONTAINER_ID = "lollipop-activations";
const DATABASE_ID = "io-auth-SM";

const aFiscalCode = "RSSMRA85T10A562S" as FiscalCode;
const anAssertionRef =
  "sha256-p1NafwcgIu9Iac3hOVdCzOWjTPwqvNRUNl6hkgTZWys=" as LollipopAssertionRef;

const aLollipopId = `LOLLIPOP-${aFiscalCode}`;

// 1 hour in the future so that computeTtl succeeds
const anExpirationDate = new Date(Date.now() + 60 * 60 * 1000);
// in the past to force computeTtl to fail
const aPastExpirationDate = new Date(Date.now() - 60 * 60 * 1000);

const aLollipopActivation: LollipopActivation = {
  fiscalCode: aFiscalCode,
  assertionRef: anAssertionRef,
  expirationDate: anExpirationDate,
};

// A valid raw lollipop activation document as persisted in Cosmos DB
const aDbLollipopResource = {
  id: aLollipopId,
  fiscalCode: aFiscalCode,
  assertionRef: anAssertionRef,
  expirationDate: anExpirationDate.toISOString(),
  ttl: 3600,
};

// ---------------------------------------------------------------------------
// Cosmos mocks
// ---------------------------------------------------------------------------

interface ContainerMock {
  itemMock: {
    read: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  item: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
  container: {
    item: ReturnType<typeof vi.fn>;
    items: {
      create: ReturnType<typeof vi.fn>;
    };
  };
}

function makeContainerMock(): ContainerMock {
  const itemMock = { read: vi.fn(), delete: vi.fn() };
  const item = vi.fn(() => itemMock);
  const create = vi.fn();

  return {
    itemMock,
    item,
    create,
    container: {
      item,
      items: { create },
    },
  };
}

function makeClientMock(lollipop: ContainerMock): CosmosClient {
  const container = vi.fn(() => lollipop.container);
  return {
    database: vi.fn(() => ({ container })),
  } as unknown as CosmosClient;
}

function makeErrorResponse(code: number): ErrorResponse {
  const e = new ErrorResponse(`cosmos error ${code}`);
  e.code = code;
  return e;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

const lollipop = makeContainerMock();
const client = makeClientMock(lollipop);
const adapter = new LollipopActivationCosmosAdapter(
  client,
  DATABASE_ID,
  LOLLIPOP_CONTAINER_ID,
);

describe("LollipopActivationCosmosAdapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // getByFiscalCode
  // -------------------------------------------------------------------------

  describe("getByFiscalCode", () => {
    it("GIVEN an existing activation WHEN getByFiscalCode is called THEN returns the activation", async () => {
      lollipop.itemMock.read.mockResolvedValue({
        resource: aDbLollipopResource,
        statusCode: 200,
      });

      const result = await adapter.getByFiscalCode(aFiscalCode);

      expect(result).toEqual(ok(aLollipopActivation));
      expect(lollipop.item).toHaveBeenCalledWith(aLollipopId, aFiscalCode);
    });

    it("GIVEN no activation WHEN getByFiscalCode is called THEN returns NotFoundError", async () => {
      lollipop.itemMock.read.mockResolvedValue({
        resource: undefined,
        statusCode: 404,
      });

      const result = await adapter.getByFiscalCode(aFiscalCode);

      expect(result).toEqual(err(expect.any(NotFoundError)));
    });

    it("GIVEN a malformed activation document WHEN getByFiscalCode is called THEN returns GenericError", async () => {
      lollipop.itemMock.read.mockResolvedValue({
        resource: { ...aDbLollipopResource, assertionRef: "invalid" },
        statusCode: 200,
      });

      const result = await adapter.getByFiscalCode(aFiscalCode);

      expect(result).toEqual(err(expect.any(GenericError)));
    });

    it("GIVEN a cosmos ErrorResponse WHEN getByFiscalCode is called THEN returns GenericError", async () => {
      lollipop.itemMock.read.mockRejectedValue(makeErrorResponse(500));

      const result = await adapter.getByFiscalCode(aFiscalCode);

      expect(result).toEqual(err(expect.any(GenericError)));
    });

    it("GIVEN a conflict cosmos error WHEN getByFiscalCode is called THEN maps it to GenericError", async () => {
      lollipop.itemMock.read.mockRejectedValue(makeErrorResponse(409));

      const result = await adapter.getByFiscalCode(aFiscalCode);

      expect(result).toEqual(err(expect.any(GenericError)));
    });
  });

  // -------------------------------------------------------------------------
  // activate
  // -------------------------------------------------------------------------

  describe("activate", () => {
    it("GIVEN a valid activation WHEN activate is called THEN persists it and returns ok", async () => {
      lollipop.create.mockResolvedValue({ resource: aDbLollipopResource });

      const result = await adapter.activate(aLollipopActivation);

      expect(result).toEqual(ok(undefined));
      expect(lollipop.create).toHaveBeenCalledTimes(1);
    });

    it("GIVEN an expiration date in the past WHEN activate is called THEN returns GenericError from ttl computation", async () => {
      const result = await adapter.activate({
        ...aLollipopActivation,
        expirationDate: aPastExpirationDate,
      });

      expect(result).toEqual(err(expect.any(GenericError)));
      expect(lollipop.create).not.toHaveBeenCalled();
    });

    it("GIVEN the activation already exists WHEN activate is called THEN returns ConflictError", async () => {
      lollipop.create.mockRejectedValue(makeErrorResponse(409));

      const result = await adapter.activate(aLollipopActivation);

      expect(result).toEqual(err(expect.any(ConflictError)));
    });

    it("GIVEN a cosmos ErrorResponse WHEN activate is called THEN returns GenericError", async () => {
      lollipop.create.mockRejectedValue(makeErrorResponse(500));

      const result = await adapter.activate(aLollipopActivation);

      expect(result).toEqual(err(expect.any(GenericError)));
    });
  });

  // -------------------------------------------------------------------------
  // revokeByFiscalCode
  // -------------------------------------------------------------------------

  describe("revokeByFiscalCode", () => {
    it("GIVEN an existing activation WHEN revokeByFiscalCode is called THEN deletes it and returns ok", async () => {
      lollipop.itemMock.read.mockResolvedValue({
        resource: aDbLollipopResource,
        statusCode: 200,
      });
      lollipop.itemMock.delete.mockResolvedValue({ statusCode: 204 });

      const result = await adapter.revokeByFiscalCode(aFiscalCode);

      expect(result).toEqual(ok(undefined));
      expect(lollipop.item).toHaveBeenLastCalledWith(aLollipopId, aFiscalCode);
      expect(lollipop.itemMock.delete).toHaveBeenCalledTimes(1);
    });

    it("GIVEN no activation WHEN revokeByFiscalCode is called THEN returns ok and does not delete", async () => {
      lollipop.itemMock.read.mockResolvedValue({
        resource: undefined,
        statusCode: 404,
      });

      const result = await adapter.revokeByFiscalCode(aFiscalCode);

      expect(result).toEqual(ok(undefined));
      expect(lollipop.itemMock.delete).not.toHaveBeenCalled();
    });

    it("GIVEN a read error WHEN revokeByFiscalCode is called THEN returns GenericError and does not delete", async () => {
      lollipop.itemMock.read.mockResolvedValue({
        resource: aDbLollipopResource,
        statusCode: 500,
      });

      const result = await adapter.revokeByFiscalCode(aFiscalCode);

      expect(result).toEqual(err(expect.any(GenericError)));
      expect(lollipop.itemMock.delete).not.toHaveBeenCalled();
    });

    it("GIVEN the delete throws WHEN revokeByFiscalCode is called THEN returns GenericError", async () => {
      lollipop.itemMock.read.mockResolvedValue({
        resource: aDbLollipopResource,
        statusCode: 200,
      });
      lollipop.itemMock.delete.mockRejectedValue(new Error("boom"));

      const result = await adapter.revokeByFiscalCode(aFiscalCode);

      expect(result).toEqual(err(expect.any(GenericError)));
    });
  });
});
