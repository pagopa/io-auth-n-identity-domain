import { AzureFunction, Context } from "@azure/functions";
import express from "express";
import { secureExpressApp } from "@pagopa/io-functions-commons/dist/src/utils/express";
import { setAppContext } from "@pagopa/io-functions-commons/dist/src/utils/middlewares/context_middleware";
import createAzureFunctionHandler from "@pagopa/express-azure-functions/dist/src/createAzureFunctionsHandler";
import { initTelemetryClient } from "../utils/appinsights";
import { Info } from "./handler";

const app = express();
secureExpressApp(app);
initTelemetryClient();

app.get("/api/v1/info", Info());

const azureFunctionHandler = createAzureFunctionHandler(app);

const httpStart: AzureFunction = (context: Context): void => {
  setAppContext(app, context);
  azureFunctionHandler(context);
};

export default httpStart;
