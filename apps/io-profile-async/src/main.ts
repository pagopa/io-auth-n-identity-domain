import { CosmosClient } from "@azure/cosmos";
import { getConfigOrThrow } from "./config";
import { InfoFunction } from "./functions/info";

const config = getConfigOrThrow();

const cosmosClient = new CosmosClient({
  endpoint: config.COSMOSDB_URI,
  key: config.COSMOSDB_KEY
});
const database = cosmosClient.database(config.COSMOSDB_NAME);

export const Info = InfoFunction({
  connectionString: config.AZURE_STORAGE_CONNECTION_STRING,
  db: database
});
