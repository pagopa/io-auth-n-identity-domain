import type { FiscalCode, NonEmptyString } from "@pagopa/hexagonal-core";
import {
  ConflictError,
  GenericError,
  NotFoundError,
} from "@pagopa/hexagonal-core";
import crypto from "crypto";
import { err, ok } from "neverthrow";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionId } from "../../../domain/value-objects/session-id.vo.js";

import type {
  BaseSession,
  SessionWithHashedSSOTokens,
} from "../../../domain/entities/session.entity.js";
import {
  ActiveSession,
  HashedBpdSSOTokenSchema,
  HashedFimsSSOTokenSchema,
  HashedSessionTokenSchema,
  HashedWalletSSOTokenSchema,
  HashedZendeskSSOTokenSchema,
} from "../../../domain/index.js";
import {
  makeClientMock,
  makeContainerMock,
  makeErrorResponse,
} from "../__mocks__/cosmos.mock.js";
import { SessionCosmosAdapter } from "../session-cosmos.adapter.js";

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const COSMOS_SESSION_PREFIX = "SESSION-";
const COSMOS_WALLET_PREFIX = "WALLET-";
const COSMOS_BPD_PREFIX = "BPD-";
const COSMOS_FIMS_PREFIX = "FIMS-";
const COSMOS_ZENDESK_PREFIX = "ZENDESK-";

const USER_SESSION_CONTAINER_ID = "session-tokens";
const ACTIVE_SESSION_CONTAINER_ID = "active-sessions";
const DATABASE_ID = "io-auth-SM";

const aFiscalCode = "RSSMRA85T10A562S" as FiscalCode;
const aSessionId = "sessionId" as SessionId;
const aHashedSessionToken = HashedSessionTokenSchema.parse(
  crypto.createHash("sha256").update("abc123sessiontoken").digest("hex"),
);
const aHashedBpdToken = HashedBpdSSOTokenSchema.parse(
  crypto.createHash("sha256").update("bpd123token").digest("hex"),
);
const aHashedWalletToken = HashedWalletSSOTokenSchema.parse(
  crypto.createHash("sha256").update("wallet123token").digest("hex"),
);
const aHashedFimsToken = HashedFimsSSOTokenSchema.parse(
  crypto.createHash("sha256").update("fims123token").digest("hex"),
);
const aHashedZendeskToken = HashedZendeskSSOTokenSchema.parse(
  crypto.createHash("sha256").update("zendesk123token").digest("hex"),
);

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

const anActiveSession: ActiveSession = {
  fiscalCode: aFiscalCode,
  loginType: "LEGACY",
  sessionId: aSessionId,
  expirationDate: anExpirationDate,
};

// A valid raw session document as persisted in Cosmos DB
const aDbSessionResource = {
  id: COSMOS_SESSION_PREFIX + aHashedSessionToken,
  sessionId: aSessionId,
  fiscalCode: aFiscalCode,
  name: "Mario",
  familyName: "Rossi",
  dateOfBirth: new Date("1985-10-10").toISOString(),
  spidLevel: "https://www.spid.gov.it/SpidL2",
  expirationDate: anExpirationDate.toISOString(),
  createdAt: new Date().toISOString(),
};

// A valid raw active session document as persisted in Cosmos DB
const aDbActiveSessionResource = {
  id: aFiscalCode,
  fiscalCode: aFiscalCode,
  loginType: "LEGACY",
  sessionId: aSessionId,
  expirationDate: anExpirationDate.toISOString(),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

const userSession = makeContainerMock();
const activeSession = makeContainerMock();
const client = makeClientMock((id) =>
  id === USER_SESSION_CONTAINER_ID ? userSession : activeSession,
);
const adapter = new SessionCosmosAdapter(
  client,
  DATABASE_ID,
  USER_SESSION_CONTAINER_ID,
  ACTIVE_SESSION_CONTAINER_ID,
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
      userSession.itemMock.read.mockResolvedValueOnce({
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
      userSession.itemMock.read.mockResolvedValueOnce({
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
      userSession.itemMock.read.mockResolvedValueOnce({
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
      userSession.itemMock.read.mockRejectedValueOnce(makeErrorResponse(500));

      const result = await adapter.findBySessionToken({
        sessionId: aSessionId,
        hashedSessionToken: aHashedSessionToken,
      });

      expect(result).toEqual(err(expect.any(GenericError)));
    });

    it("GIVEN a conflict cosmos error WHEN findBySessionToken is called THEN maps it to GenericError", async () => {
      userSession.itemMock.read.mockRejectedValueOnce(makeErrorResponse(409));

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
      userSession.itemMock.read.mockResolvedValueOnce({
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
      userSession.itemMock.read.mockResolvedValueOnce({
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
    it("GIVEN valid session and active session WHEN create is called THEN persists both and returns the session", async () => {
      userSession.batch.mockResolvedValueOnce({ code: 200, result: [] });
      activeSession.create.mockResolvedValueOnce({
        resource: aDbActiveSessionResource,
      });

      const result = await adapter.create(
        anActiveSession,
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
      expect(activeSession.create).toHaveBeenCalledTimes(1);
    });

    it("GIVEN a user session already exists WHEN create is called THEN returns ConflictError and skips active session creation", async () => {
      userSession.batch.mockResolvedValueOnce({
        code: 207,
        result: [{ statusCode: 409 }],
      });

      const result = await adapter.create(
        anActiveSession,
        aSessionWithHashedTokens,
      );

      expect(result).toEqual(err(expect.any(ConflictError)));
      expect(activeSession.create).not.toHaveBeenCalled();
    });

    it("GIVEN a non-conflict batch failure WHEN create is called THEN returns GenericError", async () => {
      userSession.batch.mockResolvedValueOnce({
        code: 500,
        result: [{ statusCode: 500 }],
      });

      const result = await adapter.create(
        anActiveSession,
        aSessionWithHashedTokens,
      );

      expect(result).toEqual(err(expect.any(GenericError)));
      expect(activeSession.create).not.toHaveBeenCalled();
    });

    it("GIVEN the batch call throws WHEN create is called THEN returns GenericError", async () => {
      userSession.batch.mockRejectedValueOnce(new Error("boom"));

      const result = await adapter.create(
        anActiveSession,
        aSessionWithHashedTokens,
      );

      expect(result).toEqual(err(expect.any(GenericError)));
    });

    it("GIVEN an expiration date in the past WHEN create is called THEN returns GenericError from ttl computation", async () => {
      const result = await adapter.create(anActiveSession, {
        ...aSessionWithHashedTokens,
        expirationDate: aPastExpirationDate,
      });

      expect(result).toEqual(err(expect.any(GenericError)));
      expect(userSession.batch).not.toHaveBeenCalled();
    });

    it("GIVEN active session creation conflicts WHEN create is called THEN returns ConflictError", async () => {
      userSession.batch.mockResolvedValueOnce({ code: 200, result: [] });
      activeSession.create.mockRejectedValueOnce(makeErrorResponse(409));

      const result = await adapter.create(
        anActiveSession,
        aSessionWithHashedTokens,
      );

      expect(result).toEqual(err(expect.any(ConflictError)));
    });

    it("GIVEN active session expiration date in the past WHEN create is called THEN returns GenericError", async () => {
      userSession.batch.mockResolvedValueOnce({ code: 200, result: [] });

      const result = await adapter.create(
        { ...anActiveSession, expirationDate: aPastExpirationDate },
        aSessionWithHashedTokens,
      );

      expect(result).toEqual(err(expect.any(GenericError)));
      expect(activeSession.create).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // refresh
  // -------------------------------------------------------------------------

  describe("refresh", () => {
    it("GIVEN a valid session WHEN refresh is called THEN recreates the user session and returns it", async () => {
      userSession.batch.mockResolvedValueOnce({ code: 200, result: [] });

      const result = await adapter.refresh(aSessionWithHashedTokens);

      expect(result).toEqual(ok(aSessionWithHashedTokens));
      expect(userSession.batch).toHaveBeenCalledTimes(1);
      // refresh must not touch the active session container
      expect(activeSession.create).not.toHaveBeenCalled();
    });

    it("GIVEN a conflict WHEN refresh is called THEN returns ConflictError", async () => {
      userSession.batch.mockResolvedValueOnce({
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
    it("GIVEN an existing session WHEN delete is called THEN deletes the active session, the SSO tokens first and the main token last", async () => {
      activeSession.itemMock.delete.mockResolvedValueOnce({
        statusCode: 204,
      });
      userSession.bulk
        .mockResolvedValueOnce([
          { statusCode: 204 },
          { statusCode: 204 },
          { statusCode: 204 },
          { statusCode: 204 },
        ])
        .mockResolvedValueOnce([{ statusCode: 204 }]);

      const result = await adapter.delete(aSessionWithHashedTokens);

      expect(result).toEqual(ok(undefined));
      expect(activeSession.item).toHaveBeenCalledWith(aFiscalCode, aFiscalCode);
      // Two bulk calls: first the 4 SSO tokens, then the main session token.
      expect(userSession.bulk).toHaveBeenCalledTimes(2);

      const firstCallOps = userSession.bulk.mock.calls[0][0];
      expect(firstCallOps.map((op: { id: string }) => op.id)).toEqual([
        COSMOS_WALLET_PREFIX + aHashedWalletToken,
        COSMOS_BPD_PREFIX + aHashedBpdToken,
        COSMOS_FIMS_PREFIX + aHashedFimsToken,
        COSMOS_ZENDESK_PREFIX + aHashedZendeskToken,
      ]);

      const secondCallOps = userSession.bulk.mock.calls[1][0];
      expect(secondCallOps.map((op: { id: string }) => op.id)).toEqual([
        COSMOS_SESSION_PREFIX + aHashedSessionToken,
      ]);
    });

    it("GIVEN active session deletion returns 404 WHEN delete is called THEN still deletes the token items", async () => {
      activeSession.itemMock.delete.mockRejectedValueOnce({ code: 404 });
      userSession.bulk
        .mockResolvedValueOnce([
          { statusCode: 204 },
          { statusCode: 204 },
          { statusCode: 204 },
          { statusCode: 204 },
        ])
        .mockResolvedValueOnce([{ statusCode: 204 }]);

      const result = await adapter.delete(aSessionWithHashedTokens);

      expect(result).toEqual(ok(undefined));
      expect(userSession.bulk).toHaveBeenCalledTimes(2);
    });

    it("GIVEN active session deletion fails WHEN delete is called THEN returns GenericError and skips token deletion", async () => {
      activeSession.itemMock.delete.mockRejectedValueOnce({ code: 500 });

      const result = await adapter.delete(aSessionWithHashedTokens);

      expect(result).toEqual(err(expect.any(GenericError)));
      expect(userSession.bulk).not.toHaveBeenCalled();
    });

    it("GIVEN an SSO token deletion fails WHEN delete is called THEN the main session token is NOT deleted and returns GenericError", async () => {
      activeSession.itemMock.delete.mockResolvedValueOnce({
        statusCode: 204,
      });
      userSession.bulk.mockResolvedValueOnce([
        { statusCode: 204 },
        { statusCode: 204 },
        { statusCode: 500 },
        { statusCode: 204 },
      ]);

      const result = await adapter.delete(aSessionWithHashedTokens);

      expect(result).toEqual(err(expect.any(GenericError)));
      // The main session token (anchor) must survive: only the SSO bulk ran.
      expect(userSession.bulk).toHaveBeenCalledTimes(1);
      const onlyCallOps = userSession.bulk.mock.calls[0][0];
      expect(onlyCallOps.map((op: { id: string }) => op.id)).not.toContain(
        COSMOS_SESSION_PREFIX + aHashedSessionToken,
      );
    });

    it("GIVEN the SSO tokens bulk deletion throws WHEN delete is called THEN returns GenericError", async () => {
      activeSession.itemMock.delete.mockResolvedValueOnce({
        statusCode: 204,
      });
      userSession.bulk.mockRejectedValueOnce(new Error("boom"));

      const result = await adapter.delete(aSessionWithHashedTokens);

      expect(result).toEqual(err(expect.any(GenericError)));
      expect(userSession.bulk).toHaveBeenCalledTimes(1);
      const onlyCallOps = userSession.bulk.mock.calls[0][0];
      expect(onlyCallOps.map((op: { id: string }) => op.id)).not.toContain(
        COSMOS_SESSION_PREFIX + aHashedSessionToken,
      );
    });

    it("GIVEN SSO deletions succeed but the main token deletion fails WHEN delete is called THEN returns GenericError", async () => {
      activeSession.itemMock.delete.mockResolvedValueOnce({
        statusCode: 204,
      });
      userSession.bulk
        .mockResolvedValueOnce([
          { statusCode: 204 },
          { statusCode: 204 },
          { statusCode: 204 },
          { statusCode: 204 },
        ])
        .mockResolvedValueOnce([{ statusCode: 500 }]);

      const result = await adapter.delete(aSessionWithHashedTokens);

      expect(result).toEqual(err(expect.any(GenericError)));
      expect(userSession.bulk).toHaveBeenCalledTimes(2);
    });

    it("GIVEN 404 on SSO tokens WHEN delete is called THEN still deletes the main token (idempotent retry)", async () => {
      activeSession.itemMock.delete.mockResolvedValueOnce({
        statusCode: 204,
      });
      userSession.bulk
        .mockResolvedValueOnce([
          { statusCode: 404 },
          { statusCode: 204 },
          { statusCode: 204 },
          { statusCode: 204 },
        ])
        .mockResolvedValueOnce([{ statusCode: 204 }]);

      const result = await adapter.delete(aSessionWithHashedTokens);

      expect(result).toEqual(ok(undefined));
      expect(userSession.bulk).toHaveBeenCalledTimes(2);
    });
  });

  it("GIVEN the main token bulk deletion throws WHEN delete is called THEN returns GenericError", async () => {
    activeSession.itemMock.delete.mockResolvedValueOnce({
      statusCode: 204,
    });
    userSession.bulk
      .mockResolvedValueOnce([
        { statusCode: 204 },
        { statusCode: 204 },
        { statusCode: 204 },
        { statusCode: 204 },
      ])
      .mockRejectedValueOnce(new Error("boom"));

    const result = await adapter.delete(aSessionWithHashedTokens);

    expect(result).toEqual(err(expect.any(GenericError)));
    expect(userSession.bulk).toHaveBeenCalledTimes(2);
  });

  // -------------------------------------------------------------------------
  // invalidatePreviousSession
  // -------------------------------------------------------------------------

  describe("invalidatePreviousSession", () => {
    it("GIVEN no previous active session WHEN invalidatePreviousSession is called THEN returns ok(undefined)", async () => {
      activeSession.itemMock.read.mockResolvedValueOnce({
        resource: undefined,
        statusCode: 404,
      });

      const result = await adapter.invalidatePreviousSession(aFiscalCode);

      expect(result).toEqual(ok(undefined));
      expect(userSession.query).not.toHaveBeenCalled();
    });

    it("GIVEN an active session read error WHEN invalidatePreviousSession is called THEN returns GenericError", async () => {
      activeSession.itemMock.read.mockResolvedValueOnce({
        resource: aDbActiveSessionResource,
        statusCode: 500,
      });

      const result = await adapter.invalidatePreviousSession(aFiscalCode);

      expect(result).toEqual(err(expect.any(GenericError)));
    });

    it("GIVEN an existing session WHEN invalidatePreviousSession is called THEN deletes items and returns the previous token", async () => {
      activeSession.itemMock.read.mockResolvedValueOnce({
        resource: aDbActiveSessionResource,
        statusCode: 200,
      });
      userSession.fetchAll.mockResolvedValueOnce({
        resources: [
          { id: COSMOS_SESSION_PREFIX + aHashedSessionToken },
          { id: "WALLET-" + aHashedWalletToken },
        ],
      });
      userSession.bulk.mockResolvedValueOnce([
        { statusCode: 204 },
        { statusCode: 204 },
      ]);
      activeSession.itemMock.delete.mockResolvedValueOnce({
        statusCode: 204,
      });

      const result = await adapter.invalidatePreviousSession(aFiscalCode);

      expect(result).toEqual(
        ok({
          sessionId: aSessionId,
          hashedSessionToken: aHashedSessionToken,
        }),
      );
      expect(userSession.bulk).toHaveBeenCalledTimes(1);
      expect(activeSession.itemMock.delete).toHaveBeenCalledTimes(1);
    });

    it("GIVEN no session token item WHEN invalidatePreviousSession is called THEN returns ok(undefined)", async () => {
      activeSession.itemMock.read.mockResolvedValueOnce({
        resource: aDbActiveSessionResource,
        statusCode: 200,
      });
      userSession.fetchAll.mockResolvedValueOnce({ resources: [] });
      activeSession.itemMock.delete.mockResolvedValueOnce({
        statusCode: 204,
      });

      const result = await adapter.invalidatePreviousSession(aFiscalCode);

      expect(result).toEqual(ok(undefined));
      expect(userSession.bulk).not.toHaveBeenCalled();
    });

    it("GIVEN a bulk deletion error status WHEN invalidatePreviousSession is called THEN returns GenericError", async () => {
      activeSession.itemMock.read.mockResolvedValueOnce({
        resource: aDbActiveSessionResource,
        statusCode: 200,
      });
      userSession.fetchAll.mockResolvedValueOnce({
        resources: [{ id: COSMOS_SESSION_PREFIX + aHashedSessionToken }],
      });
      userSession.bulk.mockResolvedValueOnce([{ statusCode: 500 }]);

      const result = await adapter.invalidatePreviousSession(aFiscalCode);

      expect(result).toEqual(err(expect.any(GenericError)));
      expect(activeSession.itemMock.delete).not.toHaveBeenCalled();
    });

    it("GIVEN the query throws WHEN invalidatePreviousSession is called THEN returns GenericError", async () => {
      activeSession.itemMock.read.mockResolvedValueOnce({
        resource: aDbActiveSessionResource,
        statusCode: 200,
      });
      userSession.fetchAll.mockRejectedValueOnce(makeErrorResponse(500));

      const result = await adapter.invalidatePreviousSession(aFiscalCode);

      expect(result).toEqual(err(expect.any(GenericError)));
    });

    it("GIVEN a conflict error is thrown WHEN invalidatePreviousSession is called THEN maps it to GenericError", async () => {
      activeSession.itemMock.read.mockResolvedValueOnce({
        resource: aDbActiveSessionResource,
        statusCode: 200,
      });
      userSession.fetchAll.mockRejectedValueOnce(makeErrorResponse(409));

      const result = await adapter.invalidatePreviousSession(aFiscalCode);

      expect(result).toEqual(err(expect.any(GenericError)));
    });
  });
});
