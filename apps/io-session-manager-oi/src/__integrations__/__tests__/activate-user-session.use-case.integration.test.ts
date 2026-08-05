import { CosmosClient } from "@azure/cosmos";
import { SessionCosmosAdapter } from "@pagopa/io-auth-n-identity-session/adapters";
import { beforeAll, describe, expect, it } from "vitest";

import {
  ACTIVE_SESSION_CONTAINER_NAME,
  COSMOSDB_KEY,
  COSMOSDB_NAME,
  COSMOSDB_URI,
  IO_PROFILE_API_KEY,
  IO_PROFILE_BASE_URL,
  PLATFORM_INTERNAL_API_KEY,
  PLATFORM_INTERNAL_BASE_URL,
  SESSION_TOKEN_CONTAINER_NAME,
} from "../env.js";
import {
  buildNewSessionTokenInput,
  EXISTING_SESSION_FISCAL_CODE,
  NEW_SESSION_FISCAL_CODE,
  readActiveSessionDocument,
  readSessionTokenItemIds,
  seedSessionCosmosDb,
} from "../fixtures/sessions.fixture.js";
import { createIoProfileAdapter } from "../../adapters/outbound/io-profile.adapter.js";
import { createPlatformInternalAdapter } from "../../adapters/outbound/platform-internal.adapter.js";
import { makeActivateUserSessionUseCase } from "../../application/use-cases/activate-user-session.use-case.js";

// The number of token documents persisted for a session: the main SESSION-
// token plus the four SSO tokens (WALLET, BPD, FIMS, ZENDESK).
const EXPECTED_SESSION_TOKEN_ITEMS = 5;

// The client session token has the shape `${sessionId}.${plainSessionToken}`.
const extractSessionId = (clientSessionToken: string): string =>
  clientSessionToken.split(".")[0];

const cosmosClient = new CosmosClient({
  endpoint: COSMOSDB_URI,
  key: COSMOSDB_KEY,
});

const sessionAdapter = new SessionCosmosAdapter(
  cosmosClient,
  COSMOSDB_NAME,
  SESSION_TOKEN_CONTAINER_NAME,
  ACTIVE_SESSION_CONTAINER_NAME,
);
const adapter = createIoProfileAdapter({
  baseUrl: IO_PROFILE_BASE_URL,
  apiKey: IO_PROFILE_API_KEY,
});
const platformInternalAdapter = createPlatformInternalAdapter({
  baseUrl: PLATFORM_INTERNAL_BASE_URL,
  apiKey: PLATFORM_INTERNAL_API_KEY,
});

const activateUserSession = makeActivateUserSessionUseCase(
  sessionAdapter,
  adapter,
  platformInternalAdapter,
);

describe("activate-user-session use case (integration)", () => {
  // Provision the database and the session containers on the local Cosmos DB
  // emulator before running any test in this suite.
  beforeAll(async () => {
    await seedSessionCosmosDb();
  });

  it("returns ok with a session id and a plain session token", async () => {
    const result = await activateUserSession(
      buildNewSessionTokenInput(NEW_SESSION_FISCAL_CODE),
    );

    console.log("activateUserSession result", result);
    expect(result.isOk()).toBe(true);

    const clientSessionToken = result._unsafeUnwrap();
    expect(clientSessionToken).toBeTypeOf("string");
    expect(clientSessionToken.length).toBeGreaterThan(0);
    expect(clientSessionToken).toContain(".");
  });

  it("persists the active session and the session token documents", async () => {
    const result = await activateUserSession(
      buildNewSessionTokenInput(NEW_SESSION_FISCAL_CODE),
    );

    const sessionId = extractSessionId(result._unsafeUnwrap());

    const activeSession = await readActiveSessionDocument(
      NEW_SESSION_FISCAL_CODE,
    );
    expect(activeSession?.fiscalCode).toBe(NEW_SESSION_FISCAL_CODE);
    expect(activeSession?.sessionId).toBe(sessionId);

    const tokenItemIds = await readSessionTokenItemIds(sessionId);
    expect(tokenItemIds).toHaveLength(EXPECTED_SESSION_TOKEN_ITEMS);
    expect(tokenItemIds.some((id) => id.startsWith("SESSION-"))).toBe(true);
  });

  it("invalidates the previous session before creating the new one", async () => {
    const firstResult = await activateUserSession(
      buildNewSessionTokenInput(EXISTING_SESSION_FISCAL_CODE),
    );
    const firstSessionId = extractSessionId(firstResult._unsafeUnwrap());

    const secondResult = await activateUserSession(
      buildNewSessionTokenInput(EXISTING_SESSION_FISCAL_CODE),
    );

    expect(secondResult.isOk()).toBe(true);
    const secondSessionId = extractSessionId(secondResult._unsafeUnwrap());

    // A brand new session must be issued.
    expect(secondSessionId).not.toBe(firstSessionId);

    // The active session now points at the new session id.
    const activeSession = await readActiveSessionDocument(
      EXISTING_SESSION_FISCAL_CODE,
    );
    expect(activeSession?.sessionId).toBe(secondSessionId);

    const currentTokenItemIds = await readSessionTokenItemIds(secondSessionId);
    expect(currentTokenItemIds).toHaveLength(EXPECTED_SESSION_TOKEN_ITEMS);

    // The previous session tokens have been deleted, while the new ones exist.
    const previousTokenItemIds = await readSessionTokenItemIds(firstSessionId);
    expect(previousTokenItemIds).toHaveLength(0);
  });
});
