import { CosmosClient } from "@azure/cosmos";
import { NonEmptyStringSchema, NotFoundError } from "@pagopa/hexagonal-core";
import {
  LollipopAssertionRefSchema,
  LollipopAssertionTypeSchema,
} from "@pagopa/io-auth-n-identity-domain";
import { SessionCosmosAdapter } from "@pagopa/io-auth-n-identity-session/adapters";
import { err, ok, ResultAsync } from "neverthrow";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { IdpFriendlyNamePortMock } from "../../__mocks__/ports/friendly-name-port.mocks.js";
import { lollipopActivationPortMock } from "../../__mocks__/ports/lollipop-activation-port.mock.js";
import { lollipopRevocationPortMock } from "../../__mocks__/ports/lollipop-revocation-port.mock.js";
import { createIoProfileAdapter } from "../../adapters/outbound/io-profile.adapter.js";
import { createPlatformInternalAdapter } from "../../adapters/outbound/platform-internal.adapter.js";
import {
  makeActivateUserSessionUseCase,
  type ActivateUserSessionUseCase,
} from "../../application/use-cases/activate-user-session.use-case.js";
import { makeInvalidatePreviousUserStateUseCase } from "../../application/use-cases/invalidate-previous-user-state.use-case.js";
import { makeInvalidateSessionTokenCacheUseCase } from "../../application/use-cases/invalidate-session-token-cache.use-case.js";
import { AuthEventPort } from "../../domain/ports/outbound/auth-event.port.js";
import type { LollipopPort } from "../../domain/ports/outbound/lollipop.port.js";
import {
  ACTIVE_SESSION_CONTAINER_NAME,
  COSMOSDB_KEY,
  COSMOSDB_NAME,
  COSMOSDB_URI,
  IO_PROFILE_API_KEY,
  IO_PROFILE_BASE_URL,
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
});
const authEventPort: AuthEventPort = {
  sendEvent: () => ResultAsync.fromSafePromise(Promise.resolve(undefined)),
};

const assertion = {
  assertionRef: LollipopAssertionRefSchema.parse(
    "sha256-iwBFlFaCWaLnrCckGIyWMJBnfDkEJ-mgxZVzGICmkwU",
  ),
  rawAssertion: NonEmptyStringSchema.parse("integration-test-assertion"),
  type: LollipopAssertionTypeSchema.enum.SAML,
};

const lollipopPort = {
  reservePubKey: vi.fn(),
  activatePubKey: vi.fn().mockResolvedValue(ok(assertion.assertionRef)),
  generateLCParams: vi.fn(),
} as unknown as LollipopPort;

const mockGetFriendlyName = vi.fn();
const friendlyNamePortMock = {
  getFriendlyName: mockGetFriendlyName,
} as unknown as typeof IdpFriendlyNamePortMock;

const activateUserSessionUseCase = makeActivateUserSessionUseCase({
  sessionPort: sessionAdapter,
  profilePort: adapter,
  authEventPort: authEventPort,
  lollipopActivationPort: lollipopActivationPortMock,
  lollipopPort: lollipopPort,
  lollipopRevocationPort: lollipopRevocationPortMock,
  friendlyNamePort: friendlyNamePortMock,
  invalidatePreviousUserStateUseCase: makeInvalidatePreviousUserStateUseCase({
    sessionPort: sessionAdapter,
    lollipopActivationPort: lollipopActivationPortMock,
    lollipopRevocationPort: {
      requestRevocation: async () => ok(undefined),
    },
    invalidateSessionTokenCacheUseCase: makeInvalidateSessionTokenCacheUseCase({
      platformInternalPort: platformInternalAdapter,
    }),
  }),
  notificationPort: { deleteInstallation: async () => ok(undefined) },
});

const activateUserSession = (
  sessionToken: Parameters<ActivateUserSessionUseCase>[0]["sessionToken"],
) =>
  activateUserSessionUseCase({
    sessionToken,
    assertion,
    oidcEnvironment: "UAT",
  });

// FIXME: review and fix integration tests (https://pagopa.atlassian.net/browse/IOPID-4193)
describe("activate-user-session use case (integration)", () => {
  // Provision the database and the session containers on the local Cosmos DB
  // emulator before running any test in this suite.
  beforeAll(async () => {
    lollipopActivationPortMock.getByFiscalCode.mockResolvedValue(
      err(new NotFoundError("LollipopActivation", "not found")),
    );
    lollipopActivationPortMock.revokeByFiscalCode.mockResolvedValue(
      ok(undefined),
    );
    lollipopActivationPortMock.upsert.mockResolvedValue(ok(undefined));
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
