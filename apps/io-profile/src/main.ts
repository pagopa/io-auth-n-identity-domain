import { CosmosClient } from "@azure/cosmos";
import { Context } from "@azure/functions";
import { QueueServiceClient } from "@azure/storage-queue";
import { getMailerTransporter } from "@pagopa/io-functions-commons/dist/src/mailer";
import {
  ACTIVATION_COLLECTION_NAME,
  ActivationModel,
} from "@pagopa/io-functions-commons/dist/src/models/activation";
import {
  PROFILE_COLLECTION_NAME,
  ProfileModel,
} from "@pagopa/io-functions-commons/dist/src/models/profile";
import {
  SERVICE_COLLECTION_NAME,
  ServiceModel,
} from "@pagopa/io-functions-commons/dist/src/models/service";
import {
  SERVICE_PREFERENCES_COLLECTION_NAME,
  ServicesPreferencesModel,
} from "@pagopa/io-functions-commons/dist/src/models/service_preference";
import {
  USER_DATA_PROCESSING_COLLECTION_NAME,
  UserDataProcessingModel,
} from "@pagopa/io-functions-commons/dist/src/models/user_data_processing";
import { ulidGenerator } from "@pagopa/io-functions-commons/dist/src/utils/strings";
import { DataTableProfileEmailsRepository } from "@pagopa/io-functions-commons/dist/src/utils/unique_email_enforcement/storage";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { Millisecond } from "@pagopa/ts-commons/lib/units";
import { createTableService } from "azure-storage";
import * as df from "durable-functions";
import { pipe } from "fp-ts/lib/function";
import { getConfigOrThrow, getValidationEmailMailerConfig } from "./config";
import { getCreateValidationTokenActivityHandler } from "./functions/create-validation-token-activity";
import { EmailValidationOrchestratorHandler } from "./functions/email-validation-orchestrator";
import { GetEnqueueProfileCreationEventActivityHandler } from "./functions/enqueue-profile-creation-event-activity";
import { getGeoLocationHandler } from "./functions/get-geo-location-data-activity";
import { getMagicCodeActivityHandler } from "./functions/get-magic-code-activity";
import { GetServicesPreferencesActivityHandler } from "./functions/get-services-preferences-activity";
import { getNoticeLoginEmailOrchestratorHandler } from "./functions/notice-login-email-orchestrator";
import { getSendLoginEmailActivityHandler } from "./functions/send-templated-login-email-activity";
import { getSendValidationEmailActivityHandler } from "./functions/send-templated-validation-email-activity";
import getSendWelcomeMessagesActivityFunction from "./functions/send-welcome-messages-activity";
import { updateSubscriptionFeed } from "./functions/update-subscriptions-feed-activity";
import { getUpsertedProfileOrchestratorHandler } from "./functions/upserted-profile-orchestrator";
import { initTelemetryClient } from "./utils/appinsights";
import { randomBytes, toHash } from "./utils/crypto";
import { HTML_TO_TEXT_OPTIONS } from "./utils/email";
import { getTimeoutFetch } from "./utils/fetch";
import { geoLocationServiceClient } from "./utils/geo-location";
import {
  WebServerDependencies,
  createWebServer,
  expressToAzureFunction,
} from "./utils/http-trigger";
import { getMagicLinkServiceClient } from "./utils/magic-code";
import { getProfileEmailTableClient } from "./utils/unique-email-enforcement";
import { CreateRedisClientSingleton } from "./utils/redis";

// HTTP external requests timeout in milliseconds
const REQUEST_TIMEOUT_MS = 5000;
const config = getConfigOrThrow();

const telemetryClient = initTelemetryClient();

const timeoutFetch = getTimeoutFetch(REQUEST_TIMEOUT_MS as Millisecond);

const cosmosDbName = config.COSMOSDB_NAME;
const cosmosDbConnectionString = config.COSMOSDB_CONNECTION_STRING;

const cosmosdbClient = new CosmosClient(cosmosDbConnectionString);

const cosmosdbInstance = cosmosdbClient.database(cosmosDbName);

const userDataProcessingModel = new UserDataProcessingModel(
  cosmosdbInstance.container(USER_DATA_PROCESSING_COLLECTION_NAME),
);

const profileModel = new ProfileModel(
  cosmosdbInstance.container(PROFILE_COLLECTION_NAME),
);
const serviceModel = new ServiceModel(
  cosmosdbInstance.container(SERVICE_COLLECTION_NAME),
);
const servicePreferencesModel = new ServicesPreferencesModel(
  cosmosdbInstance.container(SERVICE_PREFERENCES_COLLECTION_NAME),
  SERVICE_PREFERENCES_COLLECTION_NAME,
);

const activationModel = new ActivationModel(
  cosmosdbInstance.container(ACTIVATION_COLLECTION_NAME),
);

const profileEmailReader = new DataTableProfileEmailsRepository(
  getProfileEmailTableClient(
    config.PROFILE_EMAIL_STORAGE_CONNECTION_STRING,
    config.PROFILE_EMAIL_STORAGE_TABLE_NAME,
  ),
);

const TOKEN_INVALID_AFTER_MS = (1000 * 60 * 60 * 24 * 30) as Millisecond; // 30 days

const tableService = createTableService(config.QueueStorageConnection);

const maintenanceTableService = createTableService(
  config.MAINTENANCE_STORAGE_ACCOUNT_CONNECTION_STRING,
);

const eventsQueueServiceClient = QueueServiceClient.fromConnectionString(
  config.EventsQueueStorageConnection,
);

const redisClientTask = CreateRedisClientSingleton(config);

const migrateServicePreferencesQueueClient =
  QueueServiceClient.fromConnectionString(
    config.MAINTENANCE_STORAGE_ACCOUNT_CONNECTION_STRING,
  ).getQueueClient(config.MIGRATE_SERVICES_PREFERENCES_PROFILE_QUEUE_NAME);

// Email data
const LOGIN_EMAIL_TITLE =
  "È stato eseguito l'accesso sull'app IO" as NonEmptyString;
const VALIDATION_EMAIL_TITLE =
  "Conferma il tuo indirizzo email" as NonEmptyString;

const loginEmailDefaults = {
  from: config.MAIL_FROM,
  htmlToTextOptions: HTML_TO_TEXT_OPTIONS,
  title: LOGIN_EMAIL_TITLE,
};

const validationEmailDefaults = {
  from: config.MAIL_FROM,
  htmlToTextOptions: HTML_TO_TEXT_OPTIONS,
  title: VALIDATION_EMAIL_TITLE,
};

const loginEmailMailerTransporter = getMailerTransporter(config);
const validationEmailMailerTransporter = pipe(
  config,
  getValidationEmailMailerConfig,
  getMailerTransporter,
);

const httpTriggerDependencies: WebServerDependencies = {
  userDataProcessingModel,
  config,
  profileModel,
  profileEmailReader,
  serviceModel,
  servicePreferencesModel,
  activationModel,
  telemetryClient,
  migrateServicePreferencesQueueClient,
  subscriptionFeedTableService: tableService,
  redisClientTask,
};

export const httpTriggerEntrypoint = pipe(
  httpTriggerDependencies,
  createWebServer,
  expressToAzureFunction,
);

// //////////////////////////
// DURABLE FUNCTIONS      //
// /////////////////////////
export const CreateValidationTokenActivity =
  getCreateValidationTokenActivityHandler(
    ulidGenerator,
    maintenanceTableService,
    config.VALIDATION_TOKENS_TABLE_NAME,
    TOKEN_INVALID_AFTER_MS,
    randomBytes,
    toHash,
  );

export const EmailValidationWithTemplateProcessOrchestrator = df.orchestrator(
  EmailValidationOrchestratorHandler,
);

export const EmitEventActivity = async (
  context: Context,
  input: unknown,
): Promise<void> => {
  // eslint-disable-next-line functional/immutable-data
  context.bindings.apievents =
    typeof input === "string" ? input : JSON.stringify(input);
};

export const EnqueueProfileCreationEventActivity =
  GetEnqueueProfileCreationEventActivityHandler(eventsQueueServiceClient);

export const GetGeoLocationDataActivity = getGeoLocationHandler(
  geoLocationServiceClient,
);

export const GetMagicCodeActivity = getMagicCodeActivityHandler(
  getMagicLinkServiceClient(
    config.MAGIC_LINK_SERVICE_PUBLIC_URL,
    config.MAGIC_LINK_SERVICE_API_KEY,
    timeoutFetch,
  ),
);

export const GetServicesPreferencesActivity =
  GetServicesPreferencesActivityHandler(servicePreferencesModel);

export const NoticeLoginEmailOrchestrator = df.orchestrator(
  getNoticeLoginEmailOrchestratorHandler,
);

export const SendTemplatedLoginEmailActivity = getSendLoginEmailActivityHandler(
  loginEmailMailerTransporter,
  loginEmailDefaults,
  config.IOWEB_ACCESS_REF,
  telemetryClient,
);

export const SendTemplatedValidationEmailActivity =
  getSendValidationEmailActivityHandler(
    validationEmailMailerTransporter,
    validationEmailDefaults,
    config.FUNCTIONS_PUBLIC_URL,
  );

export const SendWelcomeMessagesActivity =
  getSendWelcomeMessagesActivityFunction(
    config.PUBLIC_API_URL,
    config.PUBLIC_API_KEY,
    timeoutFetch,
  );

export const UpdateSubscriptionFeedActivity = async (
  context: Context,
  rawInput: unknown,
): Promise<string> =>
  updateSubscriptionFeed(
    context,
    rawInput,
    tableService,
    config.SUBSCRIPTIONS_FEED_TABLE,
  );

export const UpsertedProfileOrchestrator = df.orchestrator(
  getUpsertedProfileOrchestratorHandler({
    sendCashbackMessage: config.IS_CASHBACK_ENABLED,
  }),
);
