import { app, output } from "@azure/functions";
import { CosmosClient } from "@azure/cosmos";
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
import {
  ActivityName as CreateValidationTokenActivityName,
  getCreateValidationTokenActivityHandler,
} from "./functions/create-validation-token-activity";
import {
  OrchestratorName as EmailValidationOrchestratorName,
  EmailValidationOrchestratorHandler,
} from "./functions/email-validation-orchestrator";
import {
  ActivityName as EmitEventActivityName,
  getEmitEventActivityHandler,
} from "./functions/emit-event-activity";
import {
  ActivityName as EnqueueProfileCreationEventActivityName,
  GetEnqueueProfileCreationEventActivityHandler,
} from "./functions/enqueue-profile-creation-event-activity";
import {
  ActivityName as GetGeoLocationDataActivityName,
  getGeoLocationHandler,
} from "./functions/get-geo-location-data-activity";
import {
  ActivityName as GetMagicCodeActivityName,
  getMagicCodeActivityHandler,
} from "./functions/get-magic-code-activity";
import {
  ActivityName as GetServicesPreferencesActivityName,
  GetServicesPreferencesActivityHandler,
} from "./functions/get-services-preferences-activity";
import {
  OrchestratorName as NoticeLoginEmailOrchestratorName,
  getNoticeLoginEmailOrchestratorHandler,
} from "./functions/notice-login-email-orchestrator";
import {
  ActivityName as SendTemplatedLoginEmailActivityName,
  getSendLoginEmailActivityHandler,
} from "./functions/send-templated-login-email-activity";
import {
  ActivityName as SendTemplatedValidationEmailActivityName,
  getSendValidationEmailActivityHandler,
} from "./functions/send-templated-validation-email-activity";
import {
  ActivityName as SendWelcomeMessagesActivityName,
  getSendWelcomeMessagesActivityFunction,
} from "./functions/send-welcome-messages-activity";
import {
  ActivityName as UpdateSubscriptionFeedActivityName,
  updateSubscriptionFeed,
} from "./functions/update-subscriptions-feed-activity";
import {
  OrchestratorName as UpsertedProfileOrchestratorName,
  getUpsertedProfileOrchestratorHandler,
} from "./functions/upserted-profile-orchestrator";
import { Info } from "./functions/info";
import { Ping } from "./functions/ping";
import { CreateProfile } from "./functions/create-profile";
import { GetProfile } from "./functions/get-profile";
import { UpdateProfile } from "./functions/update-profile";
import { GetProfileVersions } from "./functions/get-profile-versions";
import { GetServicePreferences } from "./functions/get-service-preferences";
import { UpsertServicePreferences } from "./functions/upsert-service-preferences";
import { GetUserDataProcessing } from "./functions/get-user-data-processing";
import { AbortUserDataProcessing } from "./functions/abort-user-data-processing";
import { UpsertUserDataProcessing } from "./functions/upsert-user-data-processing";
import { NoticeLoginEmail } from "./functions/notice-login-email";
import { StartEmailValidationProcess } from "./functions/start-email-validation-process";
import { initTelemetryClient } from "./utils/appinsights";
import { randomBytes, toHash } from "./utils/crypto";
import { HTML_TO_TEXT_OPTIONS } from "./utils/email";
import { getTimeoutFetch } from "./utils/fetch";
import { geoLocationServiceClient } from "./utils/geo-location";
import { getMagicLinkServiceClient } from "./utils/magic-code";
import { getProfileEmailTableClient } from "./utils/unique-email-enforcement";
import { CreateRedisClientSingleton } from "./utils/redis";
import { createTracker } from "./utils/tracking";

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

// ---- OUTPUT BINDINGS ----
const eventsQueueOutput = output.storageQueue({
  connection: "EventsQueueStorageConnection",
  queueName: config.EventsQueueName,
});

// ---- ACTIVITIES ----
df.app.activity(CreateValidationTokenActivityName, {
  handler: getCreateValidationTokenActivityHandler(
    ulidGenerator,
    maintenanceTableService,
    config.VALIDATION_TOKENS_TABLE_NAME,
    TOKEN_INVALID_AFTER_MS,
    randomBytes,
    toHash,
  ),
});

df.app.activity(EmitEventActivityName, {
  extraOutputs: [eventsQueueOutput],
  handler: getEmitEventActivityHandler(eventsQueueOutput),
});

df.app.activity(EnqueueProfileCreationEventActivityName, {
  handler: GetEnqueueProfileCreationEventActivityHandler(
    eventsQueueServiceClient,
  ),
});

df.app.activity(GetGeoLocationDataActivityName, {
  handler: getGeoLocationHandler(geoLocationServiceClient),
});

df.app.activity(GetMagicCodeActivityName, {
  handler: getMagicCodeActivityHandler(
    getMagicLinkServiceClient(
      config.MAGIC_LINK_SERVICE_PUBLIC_URL,
      config.MAGIC_LINK_SERVICE_API_KEY,
      timeoutFetch,
    ),
  ),
});

df.app.activity(GetServicesPreferencesActivityName, {
  handler: GetServicesPreferencesActivityHandler(servicePreferencesModel),
});

df.app.activity(SendTemplatedLoginEmailActivityName, {
  handler: getSendLoginEmailActivityHandler(
    loginEmailMailerTransporter,
    loginEmailDefaults,
    config.IOWEB_ACCESS_REF,
    telemetryClient,
  ),
});

df.app.activity(SendTemplatedValidationEmailActivityName, {
  handler: getSendValidationEmailActivityHandler(
    validationEmailMailerTransporter,
    validationEmailDefaults,
    config.FUNCTIONS_PUBLIC_URL,
    config.IOWEB_ACCESS_REF,
    config.FF_ENABLE_IOWEB_EMAIL_ACTIONS,
  ),
});

df.app.activity(SendWelcomeMessagesActivityName, {
  handler: getSendWelcomeMessagesActivityFunction(
    config.PUBLIC_API_URL,
    config.PUBLIC_API_KEY,
    timeoutFetch,
  ),
});

df.app.activity(UpdateSubscriptionFeedActivityName, {
  handler: async (rawInput: unknown, context) =>
    updateSubscriptionFeed(
      rawInput,
      context,
      tableService,
      config.SUBSCRIPTIONS_FEED_TABLE,
    ),
});

// ---- ORCHESTRATORS ----
df.app.orchestration(
  UpsertedProfileOrchestratorName,
  getUpsertedProfileOrchestratorHandler({
    sendCashbackMessage: config.IS_CASHBACK_ENABLED,
  }),
);

df.app.orchestration(
  EmailValidationOrchestratorName,
  EmailValidationOrchestratorHandler,
);

df.app.orchestration(
  NoticeLoginEmailOrchestratorName,
  getNoticeLoginEmailOrchestratorHandler,
);

// ---- HTTP FUNCTIONS ----
app.http("Info", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "v1/info",
  handler: Info(),
});

app.http("Ping", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "v1/ping",
  handler: Ping(),
});

app.http("GetProfile", {
  methods: ["GET"],
  authLevel: "function",
  route: "v1/profiles/{fiscalcode}",
  handler: GetProfile(
    profileModel,
    config.OPT_OUT_EMAIL_SWITCH_DATE,
    profileEmailReader,
  ),
});

app.http("CreateProfile", {
  methods: ["POST"],
  authLevel: "function",
  route: "v1/profiles/{fiscalcode}",
  extraInputs: [df.input.durableClient()],
  handler: CreateProfile(profileModel, config.OPT_OUT_EMAIL_SWITCH_DATE),
});

app.http("UpdateProfile", {
  methods: ["PUT"],
  authLevel: "function",
  route: "v1/profiles/{fiscalcode}",
  extraInputs: [df.input.durableClient()],
  handler: UpdateProfile(
    profileModel,
    migrateServicePreferencesQueueClient,
    createTracker(telemetryClient),
    profileEmailReader,
  ),
});

app.http("GetProfileVersions", {
  methods: ["GET"],
  authLevel: "function",
  route: "v1/profiles/{fiscalcode}/versions",
  handler: GetProfileVersions({
    profileModel,
    optOutEmailSwitchDate: config.OPT_OUT_EMAIL_SWITCH_DATE,
    profileEmailReader,
  }),
});

app.http("GetServicePreferences", {
  methods: ["GET"],
  authLevel: "function",
  route: "v1/profiles/{fiscalcode}/services/{serviceId}/preferences",
  handler: GetServicePreferences(
    profileModel,
    serviceModel,
    servicePreferencesModel,
    activationModel,
    redisClientTask,
    config.SERVICE_CACHE_TTL_SECONDS,
  ),
});

app.http("UpsertServicePreferences", {
  methods: ["POST"],
  authLevel: "function",
  route: "v1/profiles/{fiscalcode}/services/{serviceId}/preferences",
  extraOutputs: [eventsQueueOutput],
  handler: UpsertServicePreferences(
    eventsQueueOutput,
    telemetryClient,
    profileModel,
    serviceModel,
    servicePreferencesModel,
    activationModel,
    tableService,
    config.SUBSCRIPTIONS_FEED_TABLE,
    redisClientTask,
    config.SERVICE_CACHE_TTL_SECONDS,
  ),
});

app.http("GetUserDataProcessing", {
  methods: ["GET"],
  authLevel: "function",
  route: "v1/user-data-processing/{fiscalcode}/{choice}",
  handler: GetUserDataProcessing(userDataProcessingModel),
});

app.http("AbortUserDataProcessing", {
  methods: ["DELETE"],
  authLevel: "function",
  route: "v1/user-data-processing/{fiscalcode}/{choice}",
  handler: AbortUserDataProcessing(userDataProcessingModel),
});

app.http("UpsertUserDataProcessing", {
  methods: ["POST"],
  authLevel: "function",
  route: "v1/user-data-processing/{fiscalcode}",
  handler: UpsertUserDataProcessing(userDataProcessingModel),
});

app.http("NoticeLoginEmail", {
  methods: ["POST"],
  authLevel: "function",
  route: "v1/notify-login",
  extraInputs: [df.input.durableClient()],
  handler: NoticeLoginEmail(createTracker(telemetryClient)),
});

app.http("StartEmailValidationProcess", {
  methods: ["POST"],
  authLevel: "function",
  route: "v1/email-validation-process/{fiscalcode}",
  extraInputs: [df.input.durableClient()],
  handler: StartEmailValidationProcess(profileModel),
});
