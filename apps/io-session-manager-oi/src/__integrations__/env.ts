export const IO_PROFILE_BASE_URL = `http://localhost:${process.env.FUNCTION_PROFILE_PORT ?? 7076}/api/v1`;

export const IO_PROFILE_API_KEY = process.env.IO_PROFILE_API_KEY ?? "api_key";

export const ENVIRONMENT = process.env.ENVIRONMENT || "DEV";

// Cosmos DB (local emulator started via docker-compose).
// Tests run on the host, so the emulator must be reached through the
// port published by docker-compose, not through the internal `cosmosdb`
// hostname used by containers on the `io-fn` network.
export const COSMOSDB_PORT = Number(process.env.COSMOSDB_PORT ?? 3000);

export const COSMOSDB_URI =
  process.env.COSMOSDB_URI ?? `https://localhost:${COSMOSDB_PORT}`;

export const COSMOSDB_KEY = process.env.COSMOSDB_KEY ?? "dummykey";

// Must match the database used by the `io-profile` container
// (see docker/.env.common.example).
export const COSMOSDB_NAME = process.env.COSMOSDB_NAME ?? "testdb";

// Must match PROFILE_COLLECTION_NAME from @pagopa/io-functions-commons.
export const PROFILE_CONTAINER_NAME = "profiles";
