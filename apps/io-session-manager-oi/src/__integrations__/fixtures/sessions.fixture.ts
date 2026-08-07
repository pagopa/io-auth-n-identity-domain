import { CosmosClient } from "@azure/cosmos";
import {
  FiscalCodeSchema,
  FiscalCodeBrand,
  NonEmptyStringSchema,
} from "@pagopa/hexagonal-core";

import { NewSessionToken } from "../../application/use-cases/activate-user-session.use-case.js";
import {
  ACTIVE_SESSION_CONTAINER_NAME,
  COSMOSDB_KEY,
  COSMOSDB_NAME,
  COSMOSDB_URI,
  SESSION_TOKEN_CONTAINER_NAME,
} from "../env.js";

// The user session tokens are stored partitioned by their session tracking id,
// while the active session metadata is partitioned by fiscal code.
const SESSION_TOKEN_PARTITION_KEY_PATH = "/sessionId";
const ACTIVE_SESSION_PARTITION_KEY_PATH = "/fiscalCode";

// A fiscal code with no active session, used to exercise the "first login" path.
export const NEW_SESSION_FISCAL_CODE =
  FiscalCodeSchema.parse("RSSMRA85T10A562X");

// A fiscal code used to exercise the "previous session invalidation" path.
export const EXISTING_SESSION_FISCAL_CODE =
  FiscalCodeSchema.parse("VRDLGU90A01F205N");

/**
 * Builds a valid `NewSessionToken` input for the use case, i.e. a `BaseSession`
 * without the fields that are generated internally (`sessionId` and
 * `expirationDate`).
 */
export const buildNewSessionTokenInput = (
  fiscalCode: string,
): NewSessionToken => ({
  fiscalCode: FiscalCodeSchema.parse(fiscalCode),
  name: NonEmptyStringSchema.parse("Mario"),
  familyName: NonEmptyStringSchema.parse("Rossi"),
  dateOfBirth: new Date("1985-10-10"),
  spidLevel: "https://www.spid.gov.it/SpidL2",
  ipAddress: "127.0.0.1", // TODO: use a valid IP string
  loginType: "LEGACY",
  identityProvider: NonEmptyStringSchema.parse("spid"),
});

/**
 * Lazily-built Cosmos DB client pointing at the local emulator. It is used both
 * to provision the session containers and to assert the persisted state.
 */
let cosmosClient: CosmosClient | undefined;

export const getCosmosClient = (): CosmosClient => {
  // The local Cosmos DB emulator serves HTTPS with a self-signed certificate;
  // disable strict TLS validation for this process only.
  process.env.NODE_TLS_REJECT_UNAUTHORIZED ??= "0";

  if (!cosmosClient) {
    cosmosClient = new CosmosClient({
      endpoint: COSMOSDB_URI,
      key: COSMOSDB_KEY,
    });
  }

  return cosmosClient;
};

/**
 * Creates the database and the two session containers on the local Cosmos DB
 * emulator, matching the partition keys expected by `SessionCosmosAdapter`.
 */
export const seedSessionCosmosDb = async (): Promise<void> => {
  const { database } = await getCosmosClient().databases.createIfNotExists({
    id: COSMOSDB_NAME,
  });

  await database.containers.createIfNotExists({
    id: SESSION_TOKEN_CONTAINER_NAME,
    partitionKey: { paths: [SESSION_TOKEN_PARTITION_KEY_PATH] },
    defaultTtl: -1,
  });

  await database.containers.createIfNotExists({
    id: ACTIVE_SESSION_CONTAINER_NAME,
    partitionKey: { paths: [ACTIVE_SESSION_PARTITION_KEY_PATH] },
    defaultTtl: -1,
  });
};

/**
 * Reads the active session document persisted for the given fiscal code, or
 * `undefined` when no active session exists.
 */
export const readActiveSessionDocument = async (
  fiscalCode: string,
): Promise<{ fiscalCode: string; sessionId: string } | undefined> => {
  const container = getCosmosClient()
    .database(COSMOSDB_NAME)
    .container(ACTIVE_SESSION_CONTAINER_NAME);

  const { resource } = await container
    .item(fiscalCode, fiscalCode)
    .read<{ fiscalCode: string; sessionId: string }>();

  return resource ?? undefined;
};

/**
 * Returns the ids of the token documents persisted for the given session id.
 * A freshly created session yields five items (the main session token plus the
 * four SSO tokens: WALLET, BPD, FIMS, ZENDESK).
 */
export const readSessionTokenItemIds = async (
  sessionId: string,
): Promise<string[]> => {
  const container = getCosmosClient()
    .database(COSMOSDB_NAME)
    .container(SESSION_TOKEN_CONTAINER_NAME);

  const { resources } = await container.items
    .query<{
      id: string;
    }>(
      {
        query: "SELECT c.id FROM c WHERE c.sessionId = @sessionId",
        parameters: [{ name: "@sessionId", value: sessionId }],
      },
      { partitionKey: sessionId },
    )
    .fetchAll();

  return resources.map((item) => item.id);
};
