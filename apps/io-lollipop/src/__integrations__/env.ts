export const AzureWebJobsStorage = process.env.AzureWebJobsStorage;
export const QueueStorageConnection = process.env.QueueStorageConnection || "";

// Milliseconds to wait for test completion
export const WAIT_MS = Number(process.env.WAIT_MS ?? 5000);
export const SHOW_LOGS = process.env.SHOW_LOGS === "true";

export const COSMOSDB_URI = process.env.COSMOSDB_URI ?? "";
export const COSMOSDB_KEY = process.env.COSMOSDB_KEY ?? "";
export const COSMOSDB_NAME = process.env.COSMOSDB_NAME ?? "db";
export const LOLLIPOP_ASSERTION_STORAGE_CONNECTION_STRING =
  process.env.LOLLIPOP_ASSERTION_STORAGE_CONNECTION_STRING ?? "";

export const BEARER_AUTH_HEADER = process.env.BEARER_AUTH_HEADER ?? "";
export const A_WRONG_PRIVATE_KEY = process.env.A_WRONG_PRIVATE_KEY ?? "";
export const ISSUER = process.env.ISSUER ?? "";
