import { CosmosClient } from "@azure/cosmos";
import { getMailerTransporter } from "@pagopa/io-functions-commons/dist/src/mailer";
import { getConfigOrThrow } from "./config";
import { ExpiredSessionAdvisorFunction } from "./functions/expired-session-advisor";
import { InfoFunction } from "./functions/info";
import { ExpiredSessionAdvisorQueueMessage } from "./types/expired-session-advisor-queue-message";
import { buildIoBackendInternalClient } from "./utils/backend-internal-client/dependency";
import {
  EXPIRED_SESSION_EMAIL_TITLE,
  HTML_TO_TEXT_OPTIONS
} from "./utils/email-utils";
import { getFetchApi } from "./utils/fetch-utils";
import { buildFunctionProfileClient } from "./utils/function-profile-client/dependency";

const config = getConfigOrThrow();

const cosmosClient = new CosmosClient({
  endpoint: config.COSMOSDB_URI,
  key: config.COSMOSDB_KEY
});
const database = cosmosClient.database(config.COSMOSDB_NAME);

const fetchApi = getFetchApi(config);
const backendInternalClient = buildIoBackendInternalClient(fetchApi, config);
const functionProfileClient = buildFunctionProfileClient(fetchApi, config);

export const Info = InfoFunction({
  connectionString: config.AZURE_STORAGE_CONNECTION_STRING,
  db: database
});

export const ExpiredSessionAdvisor = ExpiredSessionAdvisorFunction({
  from: config.MAIL_FROM,
  htmlToTextOptions: HTML_TO_TEXT_OPTIONS,
  title: EXPIRED_SESSION_EMAIL_TITLE
})({
  backendInternalClient,
  functionProfileClient,
  inputDecoder: ExpiredSessionAdvisorQueueMessage,
  mailerTransporter: getMailerTransporter(config)
});
