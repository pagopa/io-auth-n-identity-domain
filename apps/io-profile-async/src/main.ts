import { CosmosClient } from "@azure/cosmos";
import { getMailerTransporter } from "@pagopa/io-functions-commons/dist/src/mailer";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { HtmlToTextOptions } from "html-to-text";
import { getConfigOrThrow } from "./config";
import { ExpiredSessionAdvisorFunction } from "./functions/expired-session-advisor";
import { InfoFunction } from "./functions/info";
import { ExpiredSessionAdvisorQueueMessage } from "./types/expired-session-advisor-queue-message";
import { buildIoBackendInternalClient } from "./utils/backend-internal-client/dependency";
import { getFetchApi } from "./utils/fetch-utils";
import { buildFunctionProfileClient } from "./utils/function-profile-client/dependency";
import { initTelemetryClient } from "./utils/appinsights";

const config = getConfigOrThrow();

initTelemetryClient();

const cosmosClient = new CosmosClient({
  endpoint: config.COSMOSDB_URI,
  key: config.COSMOSDB_KEY
});
const database = cosmosClient.database(config.COSMOSDB_NAME);

const fetchApi = getFetchApi(config);
const backendInternalClient = buildIoBackendInternalClient(fetchApi, config);
const functionProfileClient = buildFunctionProfileClient(fetchApi, config);

const HTML_TO_TEXT_OPTIONS: HtmlToTextOptions = {
  selectors: [{ selector: "img", format: "skip" }], // Ignore all document images
  tables: true
};

export const Info = InfoFunction({
  connectionString: config.AZURE_STORAGE_CONNECTION_STRING,
  db: database
});

export const ExpiredSessionAdvisor = ExpiredSessionAdvisorFunction({
  dryRunFeatureFlag: config.FF_DRY_RUN,
  expiredSessionEmailParameters: {
    from: config.MAIL_FROM,
    htmlToTextOptions: HTML_TO_TEXT_OPTIONS,
    title: "Importante: la tua sessione è scaduta." as NonEmptyString,
    ctaUrl: config.EXPIRED_SESSION_CTA_URL
  }
})({
  backendInternalClient,
  functionProfileClient,
  inputDecoder: ExpiredSessionAdvisorQueueMessage,
  mailerTransporter: getMailerTransporter(config)
});
