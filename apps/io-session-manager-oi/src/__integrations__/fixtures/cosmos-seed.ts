import { CosmosClient } from "@azure/cosmos";

import {
  COSMOSDB_KEY,
  COSMOSDB_NAME,
  COSMOSDB_URI,
  PROFILE_CONTAINER_NAME,
} from "../env.js";
import {
  existingProfileDocument,
  PROFILE_PARTITION_KEY_PATH,
} from "./profiles.fixture.js";

export async function seedCosmosDb(): Promise<void> {
  // The local Cosmos DB emulator serves HTTPS with a self-signed
  // certificate; disable strict TLS validation for this process only,
  // matching the convention already used by `io-profile`
  process.env.NODE_TLS_REJECT_UNAUTHORIZED ??= "0";

  const client = new CosmosClient({
    endpoint: COSMOSDB_URI,
    key: COSMOSDB_KEY,
  });

  const { database } = await client.databases.createIfNotExists({
    id: COSMOSDB_NAME,
  });

  const { container } = await database.containers.createIfNotExists({
    id: PROFILE_CONTAINER_NAME,
    partitionKey: { paths: [PROFILE_PARTITION_KEY_PATH] },
  });

  await container.items.upsert(existingProfileDocument);
}
