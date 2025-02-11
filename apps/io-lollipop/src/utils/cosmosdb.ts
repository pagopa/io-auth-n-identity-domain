/**
 * Use a singleton CosmosDB client across functions.
 */
import { CosmosClient } from "@azure/cosmos";
import { getConfigOrThrow } from "./config";

const config = getConfigOrThrow();
const cosmosDbUri = config.COSMOSDB_URI;
const masterKey = config.COSMOSDB_KEY;
const cosmosDbName = config.COSMOSDB_NAME;

export const cosmosdbClient = new CosmosClient({
  endpoint: cosmosDbUri,
  key: masterKey
});

export const cosmosdbInstance = cosmosdbClient.database(cosmosDbName);
