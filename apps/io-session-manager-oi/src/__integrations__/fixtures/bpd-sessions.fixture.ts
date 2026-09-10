import type { FiscalCode, NonEmptyString } from "@pagopa/hexagonal-core";
import { FiscalCodeSchema, NonEmptyStringSchema } from "@pagopa/hexagonal-core";
import {
  PlainBpdSSOTokenSchema,
  SessionIdSchema,
  type SessionId,
  toHashedBpdSSOToken,
} from "@pagopa/io-auth-n-identity-session/value-objects";
import crypto from "crypto";

import { COSMOSDB_NAME, SESSION_TOKEN_CONTAINER_NAME } from "../env.js";
import { getCosmosClient } from "./sessions.fixture.js";

// Matches the `COSMOS_BPD_PREFIX` used by `SessionCosmosAdapter` internally.
const COSMOS_BPD_PREFIX = "BPD-";

const sha256Hex = (input: string): string =>
  crypto.createHash("sha256").update(input).digest("hex");

export const BPD_TEST_SESSION_ID: SessionId = SessionIdSchema.parse(
  "test-bpd-integration-session-id",
);

export const BPD_TEST_PLAIN_TOKEN = PlainBpdSSOTokenSchema.parse(
  sha256Hex("bpd-integration-test-seed"),
);

export const BPD_TEST_HASHED_TOKEN = toHashedBpdSSOToken(BPD_TEST_PLAIN_TOKEN);

export const BPD_TEST_BEARER = `Bearer ${BPD_TEST_SESSION_ID}.${BPD_TEST_PLAIN_TOKEN}`;

export const BPD_TEST_USER: {
  fiscalCode: FiscalCode;
  name: NonEmptyString;
  familyName: NonEmptyString;
} = {
  fiscalCode: FiscalCodeSchema.parse("RSSMRA80A15H501Z"),
  name: NonEmptyStringSchema.parse("Mario"),
  familyName: NonEmptyStringSchema.parse("Rossi"),
};

/**
 * Upserts a session-token document keyed by the BPD SSO token so that
 * `SessionCosmosAdapter.findByBpdToken` returns a `BaseSession` for the
 * `(BPD_TEST_SESSION_ID, BPD_TEST_HASHED_TOKEN)` pair.
 *
 * Requires `seedSessionCosmosDb()` to have created the container beforehand.
 */
export const seedBpdSession = async (): Promise<void> => {
  const container = getCosmosClient()
    .database(COSMOSDB_NAME)
    .container(SESSION_TOKEN_CONTAINER_NAME);

  await container.items.upsert({
    id: `${COSMOS_BPD_PREFIX}${BPD_TEST_HASHED_TOKEN}`,
    sessionId: BPD_TEST_SESSION_ID,
    fiscalCode: BPD_TEST_USER.fiscalCode,
    name: BPD_TEST_USER.name,
    familyName: BPD_TEST_USER.familyName,
    dateOfBirth: new Date("1980-01-15T00:00:00.000Z").toISOString(),
    spidLevel: "https://www.spid.gov.it/SpidL2",
    expirationDate: new Date(
      Date.now() + 30 * 24 * 60 * 60 * 1000,
    ).toISOString(),
    createdAt: new Date().toISOString(),
  });
};
