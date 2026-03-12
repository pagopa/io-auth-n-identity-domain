import { app } from "@azure/functions";
import { TableClient } from "@azure/data-tables";
import { CosmosClient } from "@azure/cosmos";

import {
  PROFILE_COLLECTION_NAME,
  ProfileModel,
} from "@pagopa/io-functions-commons/dist/src/models/profile";
import { DataTableProfileEmailsRepository } from "@pagopa/io-functions-commons/dist/src/utils/unique_email_enforcement/storage";

import { profileEmailTableClient } from "./utils/unique_email_enforcement";
import { getConfigOrThrow } from "./utils/config";
import {
  GetTokenInfo,
  ValidateProfileEmail,
} from "./ValidateProfileEmailV2/handler";
import { Info } from "./Info/handler";

// -----------------------------------------------------------------
// CONFIG SETUP
// -----------------------------------------------------------------

const config = getConfigOrThrow();

const tableClient = TableClient.fromConnectionString(
  config.MAINTENANCE_STORAGE_ACCOUNT_CONNECTION_STRING,
  config.VALIDATION_TOKENS_TABLE_NAME,
);

const cosmosClient = new CosmosClient({
  endpoint: config.COSMOSDB_URI,
  key: config.COSMOSDB_KEY,
});

const profilesContainer = cosmosClient
  .database(config.COSMOSDB_NAME)
  .container(PROFILE_COLLECTION_NAME);

const profileModel = new ProfileModel(profilesContainer);

const profileEmailsReader = new DataTableProfileEmailsRepository(
  profileEmailTableClient,
);

// -----------------------------------------------------------------
// MOUNT HANDLERS
// -----------------------------------------------------------------

app.http("Info", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "info",
  handler: Info(),
});

app.http("GetTokenInfo", {
  methods: ["GET"],
  authLevel: "function",
  route: "/api/v2/validate-profile-email",
  handler: GetTokenInfo(tableClient, profileModel, profileEmailsReader),
});

app.http("ValidateProfileEmail", {
  methods: ["POST"],
  authLevel: "function",
  route: "/api/v2/validate-profile-email",
  handler: ValidateProfileEmail(tableClient, profileModel, profileEmailsReader),
});
