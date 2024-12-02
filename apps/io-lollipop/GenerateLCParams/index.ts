import { Context } from "@azure/functions";
import * as express from "express";

import { useWinstonFor } from "@pagopa/winston-ts";
import { LoggerId } from "@pagopa/winston-ts/dist/types/logging";
import { AzureContextTransport } from "@pagopa/io-functions-commons/dist/src/utils/logging";
import { withApplicationInsight } from "@pagopa/io-functions-commons/dist/src/utils/transports/application_insight";
import { secureExpressApp } from "@pagopa/io-functions-commons/dist/src/utils/express";
import { setAppContext } from "@pagopa/io-functions-commons/dist/src/utils/middlewares/context_middleware";

import createAzureFunctionHandler from "@pagopa/express-azure-functions/dist/src/createAzureFunctionsHandler";

import {
  LolliPOPKeysModel,
  LOLLIPOPKEYS_COLLECTION_NAME
} from "../model/lollipop_keys";

import { cosmosdbInstance } from "../utils/cosmosdb";
import { initTelemetryClient } from "../utils/appinsights";
import { getConfigOrThrow } from "../utils/config";
import { getGenerateAuthJWT } from "../utils/auth_jwt";
import { getPublicKeyDocumentReader } from "../utils/readers";

import { GenerateLCParams } from "./handler";

const config = getConfigOrThrow();

const telemetryClient = initTelemetryClient(
  config.APPINSIGHTS_INSTRUMENTATIONKEY
);

// eslint-disable-next-line functional/no-let
let logger: Context["log"];
const azureContextTransport = new AzureContextTransport(() => logger, {});
useWinstonFor({
  loggerId: LoggerId.event,
  transports: [
    withApplicationInsight(telemetryClient, "lollipop"),
    azureContextTransport
  ]
});
useWinstonFor({
  loggerId: LoggerId.default,
  transports: [azureContextTransport]
});

const lollipopKeysModel = new LolliPOPKeysModel(
  cosmosdbInstance.container(LOLLIPOPKEYS_COLLECTION_NAME)
);

// Setup Express
const app = express();
secureExpressApp(app);

app.post(
  "/api/v1/pubKeys/:assertion_ref/generate",
  GenerateLCParams(
    getPublicKeyDocumentReader(lollipopKeysModel),
    config.KEYS_EXPIRE_GRACE_PERIODS_IN_DAYS,
    getGenerateAuthJWT(config)
  )
);

const azureFunctionHandler = createAzureFunctionHandler(app);

// Binds the express app to an Azure Function handler
const httpStart = (context: Context): void => {
  logger = context.log;
  setAppContext(app, context);
  azureFunctionHandler(context);
};

export default httpStart;
