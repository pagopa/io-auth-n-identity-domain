import { AzureFunction, Context } from "@azure/functions";
import * as express from "express";
import { secureExpressApp } from "@pagopa/io-functions-commons/dist/src/utils/express";
import { setAppContext } from "@pagopa/io-functions-commons/dist/src/utils/middlewares/context_middleware";
import createAzureFunctionHandler from "@pagopa/express-azure-functions/dist/src/createAzureFunctionsHandler";
import { createClient as externalClient } from "../generated/definitions/external/client";
import { getConfigOrThrow } from "../utils/config";
import { getSignedMessageHandler } from "./handler";

// Setup Express
const app = express();
secureExpressApp(app);

const config = getConfigOrThrow();

const assertionClient = externalClient<"ApiKeyAuth">({
  baseUrl: config.FIRST_LC_ASSERTION_CLIENT_BASE_URL,
  fetchApi: fetch,
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  withDefaults: op => params =>
    op({
      ...params,
      ApiKeyAuth: config.FIRST_LC_ASSERTION_CLIENT_SUBSCRIPTION_KEY
    })
});

// Add express route
app.post(
  "/api/v1/first-lollipop-consumer/signed-message",
  getSignedMessageHandler(assertionClient, config)
);

const azureFunctionHandler = createAzureFunctionHandler(app);

const httpStart: AzureFunction = (context: Context): void => {
  setAppContext(app, context);
  azureFunctionHandler(context);
};

export default httpStart;
