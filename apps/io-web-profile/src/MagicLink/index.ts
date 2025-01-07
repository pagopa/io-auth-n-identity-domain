import { AzureFunction, Context } from "@azure/functions";
import createAzureFunctionHandler from "@pagopa/express-azure-functions/dist/src/createAzureFunctionsHandler";
import { secureExpressApp } from "@pagopa/io-functions-commons/dist/src/utils/express";
import { AzureContextTransport } from "@pagopa/io-functions-commons/dist/src/utils/logging";
import { setAppContext } from "@pagopa/io-functions-commons/dist/src/utils/middlewares/context_middleware";
import { useWinstonFor } from "@pagopa/winston-ts";
import { LoggerId } from "@pagopa/winston-ts/dist/types/logging";
import * as express from "express";
import { BlobServiceClient } from "@azure/storage-blob";
import { getConfigOrThrow } from "../utils/config";
import { getMagicLinkHandler } from "./handler";

const config = getConfigOrThrow();

// eslint-disable-next-line functional/no-let
let logger: Context["log"];
const azureContextTransport = new AzureContextTransport(() => logger, {});
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
  "/api/v1/magic-link",
  getMagicLinkHandler(
    config.MAGIC_LINK_JWE_ISSUER,
    config.MAGIC_LINK_JWE_PRIMARY_PUB_KEY,
    config.MAGIC_LINK_JWE_TTL,
    config.MAGIC_LINK_BASE_URL,
    containerClient
  )
);

const azureFunctionHandler = createAzureFunctionHandler(app);

const MagicLink: AzureFunction = (context: Context): void => {
  logger = context.log;
  setAppContext(app, context);
  azureFunctionHandler(context);
};

export default MagicLink;
