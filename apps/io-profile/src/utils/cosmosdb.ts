/**
 * Use a singleton CosmosDB client across functions.
 */
import { CosmosClient } from "@azure/cosmos";

import { getConfigOrThrow } from "../config";

const config = getConfigOrThrow();

// Setup DocumentDB
export const cosmosDbName = config.COSMOSDB_NAME;
export const cosmosDbConnectionString = config.COSMOSDB_CONNECTION_STRING;

export const cosmosdbClient = new CosmosClient(cosmosDbConnectionString);

export const cosmosdbInstance = cosmosdbClient.database(cosmosDbName);
