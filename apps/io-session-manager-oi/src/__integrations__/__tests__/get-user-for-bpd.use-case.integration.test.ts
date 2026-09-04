import { CosmosClient } from "@azure/cosmos";
import { AuthenticationError } from "@pagopa/hexagonal-core";
import { SessionCosmosAdapter } from "@pagopa/io-auth-n-identity-session/adapters";
import { beforeAll, describe, expect, it } from "vitest";

import { makeGetUserForBpdUseCase } from "../../application/use-cases/get-user-for-bpd.use-case.js";
import {
  ACTIVE_SESSION_CONTAINER_NAME,
  COSMOSDB_KEY,
  COSMOSDB_NAME,
  COSMOSDB_URI,
  SESSION_TOKEN_CONTAINER_NAME,
} from "../env.js";
import {
  BPD_TEST_BEARER,
  BPD_TEST_USER,
  seedBpdSession,
} from "../fixtures/bpd-sessions.fixture.js";
import { seedSessionCosmosDb } from "../fixtures/sessions.fixture.js";

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

const getUserForBpd = makeGetUserForBpdUseCase(sessionAdapter);

describe("get-user-for-bpd use case (integration)", () => {
  // Provision Cosmos containers and seed a well-known BPD session document.
  beforeAll(async () => {
    await seedSessionCosmosDb();
    await seedBpdSession();
  });

  it("returns the BPD user when the bearer resolves an existing session", async () => {
    const result = await getUserForBpd({
      authorizationHeader: BPD_TEST_BEARER,
    });

    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toStrictEqual({
      name: BPD_TEST_USER.name,
      family_name: BPD_TEST_USER.familyName,
      fiscal_code: BPD_TEST_USER.fiscalCode,
    });
  });

  it("returns AuthenticationError when no `Authorization` header is provided", async () => {
    const result = await getUserForBpd({ authorizationHeader: undefined });

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toBeInstanceOf(AuthenticationError);
  });

  it("returns AuthenticationError when the header does not start with `Bearer `", async () => {
    const result = await getUserForBpd({
      authorizationHeader: `Basic ${BPD_TEST_BEARER.slice("Bearer ".length)}`,
    });

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toBeInstanceOf(AuthenticationError);
  });

  it("returns AuthenticationError when the bearer token does not match `<sessionId>.<hash64>`", async () => {
    const result = await getUserForBpd({
      authorizationHeader: "Bearer not-a-valid-bpd-client-session-token",
    });

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toBeInstanceOf(AuthenticationError);
  });

  it("returns AuthenticationError when the session does not exist in Cosmos", async () => {
    // Well-formed bearer whose `(sessionId, plainBpdSSOToken)` pair was never seeded.
    const unknownBearer = "Bearer unknown-session-id." + "0".repeat(64);

    const result = await getUserForBpd({ authorizationHeader: unknownBearer });

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toBeInstanceOf(AuthenticationError);
  });
});
