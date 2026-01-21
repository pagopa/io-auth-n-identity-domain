import { CosmosClient } from "@azure/cosmos";
import { TableClient } from "@azure/data-tables";
import { Context } from "@azure/functions";

import express from "express";
import * as winston from "winston";

import {
  PROFILE_COLLECTION_NAME,
  ProfileModel
} from "@pagopa/io-functions-commons/dist/src/models/profile";
import { secureExpressApp } from "@pagopa/io-functions-commons/dist/src/utils/express";
import { AzureContextTransport } from "@pagopa/io-functions-commons/dist/src/utils/logging";
import { setAppContext } from "@pagopa/io-functions-commons/dist/src/utils/middlewares/context_middleware";

import createAzureFunctionHandler from "@pagopa/express-azure-functions/dist/src/createAzureFunctionsHandler";

import { DataTableProfileEmailsRepository } from "@pagopa/io-functions-commons/dist/src/utils/unique_email_enforcement/storage";
import Transport from "winston-transport";
import { getConfigOrThrow } from "../utils/config";
import { profileEmailTableClient } from "../utils/unique_email_enforcement";
import { GetTokenInfo, ValidateProfileEmail } from "./handler";

const config = getConfigOrThrow();

// Setup Express
const app = express();
secureExpressApp(app);

const tableClient = TableClient.fromConnectionString(
  config.MAINTENANCE_STORAGE_ACCOUNT_CONNECTION_STRING,
  config.VALIDATION_TOKENS_TABLE_NAME
);

const cosmosClient = new CosmosClient({
  endpoint: config.COSMOSDB_URI,
  key: config.COSMOSDB_KEY
});

const profilesContainer = cosmosClient
  .database(config.COSMOSDB_NAME)
  .container(PROFILE_COLLECTION_NAME);

const profileModel = new ProfileModel(profilesContainer);

const profileEmailsReader = new DataTableProfileEmailsRepository(
  profileEmailTableClient
);

app.get(
  "/api/v2/validate-profile-email",
  GetTokenInfo(tableClient, profileModel, profileEmailsReader)
);

app.post(
  "/api/v2/validate-profile-email",
  ValidateProfileEmail(tableClient, profileModel, profileEmailsReader)
);

const azureFunctionHandler = createAzureFunctionHandler(app);


let logger: Context["log"] | undefined;
const contextTransport = (new AzureContextTransport(() => logger, {
  level: "debug"
}) as unknown) as Transport;
winston.add(contextTransport);

// Binds the express app to an Azure Function handler
const httpStart = (context: Context): void => {
  logger = context.log;
  setAppContext(app, context);
  azureFunctionHandler(context);
};

export default httpStart;
