import { CosmosClient } from "@azure/cosmos";
import { AbortableFetch } from "@pagopa/ts-commons/lib/fetch";
import { agent } from "@pagopa/ts-commons";
import { QueueServiceClient } from "@azure/storage-queue";
import { getConfigOrThrow } from "./config";
import { InfoFunction } from "./functions/info";

const config = getConfigOrThrow();

const cosmosClient = new CosmosClient({
  endpoint: config.COSMOSDB_URI,
  key: config.COSMOSDB_KEY
});
const database = cosmosClient.database(config.COSMOSDB_NAME);

const httpApiFetch = agent.getFetch(process.env);
const abortableFetch = AbortableFetch(httpApiFetch);

export const Info = InfoFunction({
  connectionString: config.AZURE_STORAGE_CONNECTION_STRING,
  db: database
});
