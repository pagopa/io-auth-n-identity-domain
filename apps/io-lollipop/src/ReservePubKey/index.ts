import { AzureFunction, Context } from "@azure/functions";
import express from "express";
import { secureExpressApp } from "@pagopa/io-functions-commons/dist/src/utils/express";
import { setAppContext } from "@pagopa/io-functions-commons/dist/src/utils/middlewares/context_middleware";
import createAzureFunctionHandler from "@pagopa/express-azure-functions/dist/src/createAzureFunctionsHandler";
import { withApplicationInsight } from "@pagopa/io-functions-commons/dist/src/utils/transports/application_insight";
import { AzureContextTransport } from "@pagopa/io-functions-commons/dist/src/utils/logging";
import { useWinstonFor } from "@pagopa/winston-ts";
import { LoggerId } from "@pagopa/winston-ts/dist/types/logging";
import Transport from "winston-transport";
import { cosmosdbInstance } from "../utils/cosmosdb";
import {
  LolliPOPKeysModel,
  LOLLIPOPKEYS_COLLECTION_NAME
} from "../model/lollipop_keys";
import { getConfigOrThrow } from "../utils/config";
import { initTelemetryClient } from "../utils/appinsights";
import { getReservePubKeyHandler } from "./handler";

const config = getConfigOrThrow();

// Setup Express
const app = express();
secureExpressApp(app);

const lollipopPubkeysModel = new LolliPOPKeysModel(
  cosmosdbInstance.container(LOLLIPOPKEYS_COLLECTION_NAME)
);

const telemetryClient = initTelemetryClient(
  config.APPLICATIONINSIGHTS_CONNECTION_STRING
);


let logger: Context["log"];
const azureContextTransport = (new AzureContextTransport(
  () => logger,
  {}
) as unknown) as Transport;
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

// Add express route
app.post("/api/v1/pubkeys", getReservePubKeyHandler(lollipopPubkeysModel));

const azureFunctionHandler = createAzureFunctionHandler(app);

const httpStart: AzureFunction = (context: Context): void => {
  logger = context.log;
  setAppContext(app, context);
  azureFunctionHandler(context);
};

export default httpStart;
