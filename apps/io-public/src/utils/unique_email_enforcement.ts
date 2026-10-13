import { TableClient } from "@azure/data-tables";

import { getConfigOrThrow } from "./config";

const config = getConfigOrThrow();

export const profileEmailTableClient = TableClient.fromConnectionString(
  config.PROFILE_EMAIL_STORAGE_CONNECTION_STRING,
  config.PROFILE_EMAIL_STORAGE_TABLE_NAME,
  { allowInsecureConnection: process.env.NODE_ENV === "development" },
);
