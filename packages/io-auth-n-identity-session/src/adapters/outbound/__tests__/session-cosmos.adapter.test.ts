import { CosmosClient, ErrorResponse } from "@azure/cosmos";
import {
  ConflictError,
  GenericError,
  NotFoundError,
} from "@pagopa/hexagonal-core";
import type { FiscalCode, NonEmptyString } from "@pagopa/hexagonal-core";
import { err, ok } from "neverthrow";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SessionCosmosAdapter } from "../session-cosmos.adapter.js";
import type {
  BaseSession,
  SessionWithHashedSSOTokens,
} from "../../../domain/entities/session.entity.js";
import type { SessionMetadata } from "../../../domain/entities/session-metadata.entity.js";
import type { SessionTrackingId } from "../../../domain/value-objects/session-tracking-id.vo.js";
import type { HashedSessionToken } from "../../../domain/value-objects/tokens/session-token.vo.js";
import type { HashedBpdSSOToken } from "../../../domain/value-objects/tokens/bpd-sso-token.vo.js";
import type { HashedWalletSSOToken } from "../../../domain/value-objects/tokens/wallet-sso-token.vo.js";
import type { HashedFimsSSOToken } from "../../../domain/value-objects/tokens/fims-sso-token.vo.js";
import type { HashedZendeskSSOToken } from "../../../domain/value-objects/tokens/zendesk-sso-token.vo.js";

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const COSMOS_SESSION_PREFIX = "SESSION-";
const COSMOS_WALLET_PREFIX = "WALLET-";
const COSMOS_BPD_PREFIX = "BPD-";
const COSMOS_FIMS_PREFIX = "FIMS-";
const COSMOS_ZENDESK_PREFIX = "ZENDESK-";
const COSMOS_SESSION_METADATA_ID = "SESSION_METADATA";

const USER_SESSION_CONTAINER_ID = "tokens";
const SESSION_METADATA_CONTAINER_ID = "session-info";
const DATABASE_ID = "io-auth-SM";

const aFiscalCode = "RSSMRA85T10A562S" as FiscalCode;
const aSessionId = "550e8400-e29b-41d4-a716-446655440001" as SessionTrackingId;
const aHashedSessionToken = "abc123hashedsessiontoken" as HashedSessionToken;
const aHashedBpdToken = "bpd123hashedtoken" as HashedBpdSSOToken;
const aHashedWalletToken = "wallet123hashedtoken" as HashedWalletSSOToken;
const aHashedFimsToken = "fims123hashedtoken" as HashedFimsSSOToken;
const aHashedZendeskToken = "zendesk123hashedtoken" as HashedZendeskSSOToken;

// 1 hour in the future so that computeTtl succeeds
const anExpirationDate = new Date(Date.now() + 60 * 60 * 1000);
// in the past to force computeTtl to fail
const aPastExpirationDate = new Date(Date.now() - 60 * 60 * 1000);

const aBaseSession: BaseSession = {
  fiscalCode: aFiscalCode,
  name: "Mario" as NonEmptyString,
  familyName: "Rossi" as NonEmptyString,
  dateOfBirth: new Date("1985-10-10"),
  spidLevel: "https://www.spid.gov.it/SpidL2",
  sessionId: aSessionId,
  expirationDate: anExpirationDate,
};

const aSessionWithHashedTokens: SessionWithHashedSSOTokens = {
  ...aBaseSession,
  hashedSessionToken: aHashedSessionToken,
  ssoTokens: {
    bpdHashedToken: aHashedBpdToken,
    walletHashedToken: aHashedWalletToken,
    fimsHashedToken: aHashedFimsToken,
    zendeskHashedToken: aHashedZendeskToken,
  },
};

const aSessionMetadata: SessionMetadata = {
  fiscalCode: aFiscalCode,
  loginType: "LEGACY",
  sessionTrackingId: aSessionId,
  expirationDate: anExpirationDate,
};

// A valid raw session document as persisted in Cosmos DB
const aDbSessionResource = {
  id: COSMOS_SESSION_PREFIX + aHashedSessionToken,
  sessionTrackingId: aSessionId,
  fiscalCode: aFiscalCode,
  name: "Mario",
  familyName: "Rossi",
  dateOfBirth: new Date("1985-10-10").toISOString(),
  spidLevel: "https://www.spid.gov.it/SpidL2",
  expirationDate: anExpirationDate.toISOString(),
  createdAt: new Date().toISOString(),
};

// A valid raw session metadata document as persisted in Cosmos DB
const aDbSessionMetadataResource = {
  id: COSMOS_SESSION_METADATA_ID,
  type: COSMOS_SESSION_METADATA_ID,
  fiscalCode: aFiscalCode,
  loginType: "LEGACY",
  sessionTrackingId: aSessionId,
  expirationDate: anExpirationDate.toISOString(),
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
  batch: ReturnType<typeof vi.fn>;
  executeBulkOperations: ReturnType<typeof vi.fn>;
  fetchAll: ReturnType<typeof vi.fn>;
  query: ReturnType<typeof vi.fn>;
  container: {
    item: ReturnType<typeof vi.fn>;
    items: {
      create: ReturnType<typeof vi.fn>;
      batch: ReturnType<typeof vi.fn>;
      executeBulkOperations: ReturnType<typeof vi.fn>;
      query: ReturnType<typeof vi.fn>;
    };
  };
}

function makeContainerMock(): ContainerMock {
  const itemMock = { read: vi.fn(), delete: vi.fn() };
  const item = vi.fn(() => itemMock);
  const create = vi.fn();
  const batch = vi.fn();
  const executeBulkOperations = vi.fn();
  const fetchAll = vi.fn();
  const query = vi.fn(() => ({ fetchAll }));

  return {
    itemMock,
    item,
    create,
    batch,
    executeBulkOperations,
    fetchAll,
    query,
    container: {
      item,
      items: { create, batch, executeBulkOperations, query },
    },
  };
}

function makeClientMock(
  userSession: ContainerMock,
  sessionMetadata: ContainerMock,
): CosmosClient {
  const container = vi.fn((id: string) =>
    id === USER_SESSION_CONTAINER_ID
      ? userSession.container
      : sessionMetadata.container,
  );
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

const userSession = makeContainerMock();
const sessionMetadata = makeContainerMock();
const client = makeClientMock(userSession, sessionMetadata);
const adapter = new SessionCosmosAdapter(
  client,
  DATABASE_ID,
  USER_SESSION_CONTAINER_ID,
  SESSION_METADATA_CONTAINER_ID,
);

describe("SessionCosmosAdapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // findBySessionToken
  // -------------------------------------------------------------------------

  describe("findBySessionToken", () => {
    it("GIVEN an existing session WHEN findBySessionToken is called THEN returns the session", async () => {
      userSession.itemMock.read.mockResolvedValue({
        resource: aDbSessionResource,
        statusCode: 200,
      });

      const result = await adapter.findBySessionToken({
        sessionId: aSessionId,
        hashedSessionToken: aHashedSessionToken,
      });

      expect(result).toEqual(ok(aBaseSession));
      expect(userSession.item).toHaveBeenCalledWith(
        COSMOS_SESSION_PREFIX + aHashedSessionToken,
        aSessionId,
      );
    });

    it("GIVEN no session WHEN findBySessionToken is called THEN returns NotFoundError", async () => {
      userSession.itemMock.read.mockResolvedValue({
        resource: undefined,
        statusCode: 404,
      });

      const result = await adapter.findBySessionToken({
        sessionId: aSessionId,
        hashedSessionToken: aHashedSessionToken,
      });

      expect(result).toEqual(err(expect.any(NotFoundError)));
    });

    it("GIVEN a malformed session document WHEN findBySessionToken is called THEN returns GenericError", async () => {
      userSession.itemMock.read.mockResolvedValue({
        resource: { ...aDbSessionResource, fiscalCode: "invalid" },
        statusCode: 200,
      });

      const result = await adapter.findBySessionToken({
        sessionId: aSessionId,
        hashedSessionToken: aHashedSessionToken,
      });

      expect(result).toEqual(err(expect.any(GenericError)));
    });

    it("GIVEN a cosmos ErrorResponse WHEN findBySessionToken is called THEN returns GenericError", async () => {
      userSession.itemMock.read.mockRejectedValue(makeErrorResponse(500));

      const result = await adapter.findBySessionToken({
        sessionId: aSessionId,
        hashedSessionToken: aHashedSessionToken,
      });

      expect(result).toEqual(err(expect.any(GenericError)));
    });

    it("GIVEN a conflict cosmos error WHEN findBySessionToken is called THEN maps it to GenericError", async () => {
      userSession.itemMock.read.mockRejectedValue(makeErrorResponse(409));

      const result = await adapter.findBySessionToken({
        sessionId: aSessionId,
        hashedSessionToken: aHashedSessionToken,
      });

      expect(result).toEqual(err(expect.any(GenericError)));
    });
  });

  // -------------------------------------------------------------------------
  // findByBpdToken
  // -------------------------------------------------------------------------

  describe("findByBpdToken", () => {
    it("GIVEN an existing session WHEN findByBpdToken is called THEN returns the session", async () => {
      userSession.itemMock.read.mockResolvedValue({
        resource: {
          ...aDbSessionResource,
          id: COSMOS_BPD_PREFIX + aHashedBpdToken,
        },
        statusCode: 200,
      });

      const result = await adapter.findByBpdToken({
        sessionId: aSessionId,
        hashedBPDSSOToken: aHashedBpdToken,
      });

      expect(result).toEqual(ok(aBaseSession));
      expect(userSession.item).toHaveBeenCalledWith(
        COSMOS_BPD_PREFIX + aHashedBpdToken,
        aSessionId,
      );
    });

    it("GIVEN no session WHEN findByBpdToken is called THEN returns NotFoundError", async () => {
      userSession.itemMock.read.mockResolvedValue({
        resource: undefined,
        statusCode: 404,
      });

      const result = await adapter.findByBpdToken({
        sessionId: aSessionId,
        hashedBPDSSOToken: aHashedBpdToken,
      });

      expect(result).toEqual(err(expect.any(NotFoundError)));
    });
  });

  // -------------------------------------------------------------------------
  // create
  // -------------------------------------------------------------------------

  describe("create", () => {
    it("GIVEN valid session and metadata WHEN create is called THEN persists both and returns the session", async () => {
      userSession.batch.mockResolvedValue({ code: 200, result: [] });
      sessionMetadata.create.mockResolvedValue({
        resource: aDbSessionMetadataResource,
      });

      const result = await adapter.create(
        aSessionMetadata,
        aSessionWithHashedTokens,
      );

      expect(result).toEqual(ok(aSessionWithHashedTokens));
      expect(userSession.batch).toHaveBeenCalledTimes(1);
      expect(userSession.batch).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            resourceBody: expect.objectContaining({
              id: COSMOS_SESSION_PREFIX + aHashedSessionToken,
            }),
          }),
          expect.objectContaining({
            resourceBody: expect.objectContaining({
              id: COSMOS_WALLET_PREFIX + aHashedWalletToken,
            }),
          }),
          expect.objectContaining({
            resourceBody: expect.objectContaining({
              id: COSMOS_BPD_PREFIX + aHashedBpdToken,
            }),
          }),
          expect.objectContaining({
            resourceBody: expect.objectContaining({
              id: COSMOS_FIMS_PREFIX + aHashedFimsToken,
            }),
          }),
          expect.objectContaining({
            resourceBody: expect.objectContaining({
              id: COSMOS_ZENDESK_PREFIX + aHashedZendeskToken,
            }),
          }),
        ]),
        aSessionId,
      );
      expect(sessionMetadata.create).toHaveBeenCalledTimes(1);
    });

    it("GIVEN a user session already exists WHEN create is called THEN returns ConflictError and skips metadata creation", async () => {
      userSession.batch.mockResolvedValue({
        code: 207,
        result: [{ statusCode: 409 }],
      });

      const result = await adapter.create(
        aSessionMetadata,
        aSessionWithHashedTokens,
      );

      expect(result).toEqual(err(expect.any(ConflictError)));
      expect(sessionMetadata.create).not.toHaveBeenCalled();
    });

    it("GIVEN a non-conflict batch failure WHEN create is called THEN returns GenericError", async () => {
      userSession.batch.mockResolvedValue({
        code: 500,
        result: [{ statusCode: 500 }],
      });

      const result = await adapter.create(
        aSessionMetadata,
        aSessionWithHashedTokens,
      );

      expect(result).toEqual(err(expect.any(GenericError)));
      expect(sessionMetadata.create).not.toHaveBeenCalled();
    });

    it("GIVEN the batch call throws WHEN create is called THEN returns GenericError", async () => {
      userSession.batch.mockRejectedValue(new Error("boom"));

      const result = await adapter.create(
        aSessionMetadata,
        aSessionWithHashedTokens,
      );

      expect(result).toEqual(err(expect.any(GenericError)));
    });

    it("GIVEN an expiration date in the past WHEN create is called THEN returns GenericError from ttl computation", async () => {
      const result = await adapter.create(aSessionMetadata, {
        ...aSessionWithHashedTokens,
        expirationDate: aPastExpirationDate,
      });

      expect(result).toEqual(err(expect.any(GenericError)));
      expect(userSession.batch).not.toHaveBeenCalled();
    });

    it("GIVEN metadata creation conflicts WHEN create is called THEN returns ConflictError", async () => {
      userSession.batch.mockResolvedValue({ code: 200, result: [] });
      sessionMetadata.create.mockRejectedValue(makeErrorResponse(409));

      const result = await adapter.create(
        aSessionMetadata,
        aSessionWithHashedTokens,
      );

      expect(result).toEqual(err(expect.any(ConflictError)));
    });

    it("GIVEN metadata expiration date in the past WHEN create is called THEN returns GenericError", async () => {
      userSession.batch.mockResolvedValue({ code: 200, result: [] });

      const result = await adapter.create(
        { ...aSessionMetadata, expirationDate: aPastExpirationDate },
        aSessionWithHashedTokens,
      );

      expect(result).toEqual(err(expect.any(GenericError)));
      expect(sessionMetadata.create).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // refresh
  // -------------------------------------------------------------------------

  describe("refresh", () => {
    it("GIVEN a valid session WHEN refresh is called THEN recreates the user session and returns it", async () => {
      userSession.batch.mockResolvedValue({ code: 200, result: [] });

      const result = await adapter.refresh(aSessionWithHashedTokens);

      expect(result).toEqual(ok(aSessionWithHashedTokens));
      expect(userSession.batch).toHaveBeenCalledTimes(1);
      // refresh must not touch the metadata container
      expect(sessionMetadata.create).not.toHaveBeenCalled();
    });

    it("GIVEN a conflict WHEN refresh is called THEN returns ConflictError", async () => {
      userSession.batch.mockResolvedValue({
        code: 207,
        result: [{ statusCode: 409 }],
      });

      const result = await adapter.refresh(aSessionWithHashedTokens);

      expect(result).toEqual(err(expect.any(ConflictError)));
    });
  });

  // -------------------------------------------------------------------------
  // delete
  // -------------------------------------------------------------------------

  describe("delete", () => {
    it("GIVEN an existing session WHEN delete is called THEN deletes metadata, the SSO tokens first and the main token last", async () => {
      sessionMetadata.itemMock.delete.mockResolvedValue({ statusCode: 204 });
      userSession.executeBulkOperations.mockResolvedValue([
        { response: { statusCode: 204 } },
      ]);

      const result = await adapter.delete(aSessionWithHashedTokens);

      expect(result).toEqual(ok(undefined));
      expect(sessionMetadata.item).toHaveBeenCalledWith(
        COSMOS_SESSION_METADATA_ID,
        aFiscalCode,
      );
      // Two bulk calls: first the 4 SSO tokens, then the main session token.
      expect(userSession.executeBulkOperations).toHaveBeenCalledTimes(2);

      const firstCallOps = userSession.executeBulkOperations.mock.calls[0][0];
      expect(firstCallOps.map((op: { id: string }) => op.id)).toEqual([
        COSMOS_WALLET_PREFIX + aHashedWalletToken,
        COSMOS_BPD_PREFIX + aHashedBpdToken,
        COSMOS_FIMS_PREFIX + aHashedFimsToken,
        COSMOS_ZENDESK_PREFIX + aHashedZendeskToken,
      ]);

      const secondCallOps = userSession.executeBulkOperations.mock.calls[1][0];
      expect(secondCallOps.map((op: { id: string }) => op.id)).toEqual([
        COSMOS_SESSION_PREFIX + aHashedSessionToken,
      ]);
    });

    it("GIVEN metadata deletion returns 404 WHEN delete is called THEN still deletes the token items", async () => {
      sessionMetadata.itemMock.delete.mockRejectedValue({ code: 404 });
      userSession.executeBulkOperations.mockResolvedValue([
        { response: { statusCode: 204 } },
      ]);

      const result = await adapter.delete(aSessionWithHashedTokens);

      expect(result).toEqual(ok(undefined));
      expect(userSession.executeBulkOperations).toHaveBeenCalledTimes(2);
    });

    it("GIVEN metadata deletion fails WHEN delete is called THEN returns GenericError and skips token deletion", async () => {
      sessionMetadata.itemMock.delete.mockRejectedValue({ code: 500 });

      const result = await adapter.delete(aSessionWithHashedTokens);

      expect(result).toEqual(err(expect.any(GenericError)));
      expect(userSession.executeBulkOperations).not.toHaveBeenCalled();
    });

    it("GIVEN an SSO token deletion fails WHEN delete is called THEN the main session token is NOT deleted and returns GenericError", async () => {
      sessionMetadata.itemMock.delete.mockResolvedValue({ statusCode: 204 });
      userSession.executeBulkOperations.mockResolvedValueOnce([
        { response: { statusCode: 204 } },
        { response: { statusCode: 500 } },
      ]);

      const result = await adapter.delete(aSessionWithHashedTokens);

      expect(result).toEqual(err(expect.any(GenericError)));
      // The main session token (anchor) must survive: only the SSO bulk ran.
      expect(userSession.executeBulkOperations).toHaveBeenCalledTimes(1);
      const onlyCallOps = userSession.executeBulkOperations.mock.calls[0][0];
      expect(onlyCallOps.map((op: { id: string }) => op.id)).not.toContain(
        COSMOS_SESSION_PREFIX + aHashedSessionToken,
      );
    });

    it("GIVEN SSO deletions succeed but the main token deletion fails WHEN delete is called THEN returns GenericError", async () => {
      sessionMetadata.itemMock.delete.mockResolvedValue({ statusCode: 204 });
      userSession.executeBulkOperations
        .mockResolvedValueOnce([{ response: { statusCode: 204 } }])
        .mockResolvedValueOnce([{ response: { statusCode: 500 } }]);

      const result = await adapter.delete(aSessionWithHashedTokens);

      expect(result).toEqual(err(expect.any(GenericError)));
      expect(userSession.executeBulkOperations).toHaveBeenCalledTimes(2);
    });

    it("GIVEN 404 on SSO tokens WHEN delete is called THEN still deletes the main token (idempotent retry)", async () => {
      sessionMetadata.itemMock.delete.mockResolvedValue({ statusCode: 204 });
      userSession.executeBulkOperations
        .mockResolvedValueOnce([
          { response: { statusCode: 404 } },
          { response: { statusCode: 404 } },
        ])
        .mockResolvedValueOnce([{ response: { statusCode: 204 } }]);

      const result = await adapter.delete(aSessionWithHashedTokens);

      expect(result).toEqual(ok(undefined));
      expect(userSession.executeBulkOperations).toHaveBeenCalledTimes(2);
    });

    it("GIVEN the bulk deletion throws WHEN delete is called THEN returns GenericError", async () => {
      sessionMetadata.itemMock.delete.mockResolvedValue({ statusCode: 204 });
      userSession.executeBulkOperations.mockRejectedValue(new Error("boom"));

      const result = await adapter.delete(aSessionWithHashedTokens);

      expect(result).toEqual(err(expect.any(GenericError)));
    });
  });

  // -------------------------------------------------------------------------
  // invalidatePreviousSession
  // -------------------------------------------------------------------------

  describe("invalidatePreviousSession", () => {
    it("GIVEN no previous session metadata WHEN invalidatePreviousSession is called THEN returns ok(undefined)", async () => {
      sessionMetadata.itemMock.read.mockResolvedValue({
        resource: undefined,
        statusCode: 404,
      });

      const result = await adapter.invalidatePreviousSession(aFiscalCode);

      expect(result).toEqual(ok(undefined));
      expect(userSession.query).not.toHaveBeenCalled();
    });

    it("GIVEN a metadata read error WHEN invalidatePreviousSession is called THEN returns GenericError", async () => {
      sessionMetadata.itemMock.read.mockResolvedValue({
        resource: aDbSessionMetadataResource,
        statusCode: 500,
      });

      const result = await adapter.invalidatePreviousSession(aFiscalCode);

      expect(result).toEqual(err(expect.any(GenericError)));
    });

    it("GIVEN an existing session WHEN invalidatePreviousSession is called THEN deletes items and returns the previous token", async () => {
      sessionMetadata.itemMock.read.mockResolvedValue({
        resource: aDbSessionMetadataResource,
        statusCode: 200,
      });
      userSession.fetchAll.mockResolvedValue({
        resources: [
          { id: COSMOS_SESSION_PREFIX + aHashedSessionToken },
          { id: "WALLET-" + aHashedWalletToken },
        ],
      });
      userSession.executeBulkOperations.mockResolvedValue([
        { response: { statusCode: 204 } },
        { response: { statusCode: 204 } },
      ]);
      sessionMetadata.itemMock.delete.mockResolvedValue({ statusCode: 204 });

      const result = await adapter.invalidatePreviousSession(aFiscalCode);

      expect(result).toEqual(
        ok({
          sessionId: aSessionId,
          hashedSessionToken: aHashedSessionToken,
        }),
      );
      expect(userSession.executeBulkOperations).toHaveBeenCalledTimes(1);
      expect(sessionMetadata.itemMock.delete).toHaveBeenCalledTimes(1);
    });

    it("GIVEN no session token item WHEN invalidatePreviousSession is called THEN returns ok(undefined)", async () => {
      sessionMetadata.itemMock.read.mockResolvedValue({
        resource: aDbSessionMetadataResource,
        statusCode: 200,
      });
      userSession.fetchAll.mockResolvedValue({ resources: [] });
      sessionMetadata.itemMock.delete.mockResolvedValue({ statusCode: 204 });

      const result = await adapter.invalidatePreviousSession(aFiscalCode);

      expect(result).toEqual(ok(undefined));
      expect(userSession.executeBulkOperations).not.toHaveBeenCalled();
    });

    it("GIVEN a bulk deletion error status WHEN invalidatePreviousSession is called THEN returns GenericError", async () => {
      sessionMetadata.itemMock.read.mockResolvedValue({
        resource: aDbSessionMetadataResource,
        statusCode: 200,
      });
      userSession.fetchAll.mockResolvedValue({
        resources: [{ id: COSMOS_SESSION_PREFIX + aHashedSessionToken }],
      });
      userSession.executeBulkOperations.mockResolvedValue([
        { response: { statusCode: 500 } },
      ]);

      const result = await adapter.invalidatePreviousSession(aFiscalCode);

      expect(result).toEqual(err(expect.any(GenericError)));
      expect(sessionMetadata.itemMock.delete).not.toHaveBeenCalled();
    });

    it("GIVEN the query throws WHEN invalidatePreviousSession is called THEN returns GenericError", async () => {
      sessionMetadata.itemMock.read.mockResolvedValue({
        resource: aDbSessionMetadataResource,
        statusCode: 200,
      });
      userSession.fetchAll.mockRejectedValue(makeErrorResponse(500));

      const result = await adapter.invalidatePreviousSession(aFiscalCode);

      expect(result).toEqual(err(expect.any(GenericError)));
    });

    it("GIVEN a conflict error is thrown WHEN invalidatePreviousSession is called THEN maps it to GenericError", async () => {
      sessionMetadata.itemMock.read.mockResolvedValue({
        resource: aDbSessionMetadataResource,
        statusCode: 200,
      });
      userSession.fetchAll.mockRejectedValue(makeErrorResponse(409));

      const result = await adapter.invalidatePreviousSession(aFiscalCode);

      expect(result).toEqual(err(expect.any(GenericError)));
    });
  });
});
