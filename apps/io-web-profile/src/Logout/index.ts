import { AzureFunction, Context } from "@azure/functions";
import { BlobServiceClient } from "@azure/storage-blob";
import createAzureFunctionHandler from "@pagopa/express-azure-functions/dist/src/createAzureFunctionsHandler";
import { secureExpressApp } from "@pagopa/io-functions-commons/dist/src/utils/express";
import { AzureContextTransport } from "@pagopa/io-functions-commons/dist/src/utils/logging";
import { setAppContext } from "@pagopa/io-functions-commons/dist/src/utils/middlewares/context_middleware";
import { useWinstonFor } from "@pagopa/winston-ts";
import { LoggerId } from "@pagopa/winston-ts/dist/types/logging";
import express from "express";
import Transport from "winston-transport";
import { getFastLoginClient } from "../clients/fastLoginClient";
import { getConfigOrThrow } from "../utils/config";
import { initTelemetryClient } from "../utils/appinsights";
import { getLogoutHandler } from "./handler";

const config = getConfigOrThrow();
initTelemetryClient();

// eslint-disable-next-line functional/no-let
let logger: Context["log"];
const azureContextTransport = (new AzureContextTransport(
  () => logger,
  {}
) as unknown) as Transport;
useWinstonFor({
  loggerId: LoggerId.default,
  transports: [azureContextTransport]
});

const app = express();
secureExpressApp(app);

const containerClient = BlobServiceClient.fromConnectionString(
  config.AUDIT_LOG_CONNECTION_STRING
).getContainerClient(config.AUDIT_LOG_CONTAINER);

app.post(
  "/api/v1/logout",
  getLogoutHandler(
    getFastLoginClient(
      config.FAST_LOGIN_API_KEY,
      config.FAST_LOGIN_CLIENT_BASE_URL
    ),
    config,
    containerClient
  )
);

const azureFunctionHandler = createAzureFunctionHandler(app);

const Logout: AzureFunction = (context: Context): void => {
  logger = context.log;
  setAppContext(app, context);
  azureFunctionHandler(context);
};

export default Logout;
