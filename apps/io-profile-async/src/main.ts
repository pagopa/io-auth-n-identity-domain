import { app, InvocationContext, output } from "@azure/functions";
import { CosmosClient } from "@azure/cosmos";
import { QueueClient } from "@azure/storage-queue";

import { TableClient } from "@azure/data-tables";
import { getMailerTransporter } from "@pagopa/io-functions-commons/dist/src/mailer";
import {
  PROFILE_COLLECTION_NAME,
  ProfileModel,
} from "@pagopa/io-functions-commons/dist/src/models/profile";
import {
  SERVICE_PREFERENCES_COLLECTION_NAME,
  ServicesPreferencesModel,
} from "@pagopa/io-functions-commons/dist/src/models/service_preference";
import { DataTableProfileEmailsRepository } from "@pagopa/io-functions-commons/dist/src/utils/unique_email_enforcement/storage";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { HtmlToTextOptions } from "html-to-text";
import { getConfigOrThrow } from "./config";
import { ExpiredSessionAdvisorFunction } from "./functions/expired-session-advisor";
import { ExpiredSessionsDiscovererFunction } from "./functions/expired-sessions-discoverer";
import { InfoFunction } from "./functions/info";
import {
  MigrateServicePreferenceFromLegacyFunction,
  MigrateServicesPreferencesQueueMessage,
} from "./functions/migrate-service-preference-from-legacy";
import { OnProfileUpdateFunction } from "./functions/on-profile-update";
import { SessionNotificationEventsProcessorFunction } from "./functions/session-notification-events-processor";
import { StoreSpidLogsFunction } from "./functions/store-spid-logs";
import { SessionNotificationsModel } from "./models/session-notifications";
import { ProfileEmailRepository, ProfileRepository } from "./repositories";
import { ExpiredUserSessionsQueueRepository } from "./repositories/expired-user-sessions-queue";
import { repository as servicePreferencesRepository } from "./repositories/service-preferences";
import { SessionNotificationsRepository } from "./repositories/session-notifications";
import { tracker } from "./repositories/tracker";
import { ExpiredSessionAdvisorQueueMessage } from "./types/expired-session-advisor-queue-message";
import { OnProfileUpdateFunctionInput } from "./types/on-profile-update-input-document";
import { StoreSpidLogsQueueMessage } from "./types/store-spid-logs-queue-message";
import { initTelemetryClient } from "./utils/appinsights";
import { getFetchApi } from "./utils/fetch-utils";
import { buildFunctionProfileClient } from "./utils/function-profile-client/dependency";
import { buildSessionManagerInternalClient } from "./utils/session-manager-internal-client/dependency";

// -----------------------------------------------------------------
// CONFIG & DI SETUP
// -----------------------------------------------------------------

const config = getConfigOrThrow();

const telemetryClient = initTelemetryClient();

const expiredUserSessionsQueueClient = new QueueClient(
  config.AZURE_STORAGE_CONNECTION_STRING_ITN,
  config.EXPIRED_SESSION_ADVISOR_QUEUE,
);

const comsosApiCosmosClient = new CosmosClient(
  config.COSMOSDB_CONNECTION_STRING,
);
const cosmosApiDatabase = comsosApiCosmosClient.database(config.COSMOSDB_NAME);

const citizenAuthCosmosClient = new CosmosClient(
  config.CITIZEN_AUTH_COSMOSDB_CONNECTION_STRING,
);
const citizenAuthDatabase = citizenAuthCosmosClient.database(
  config.CITIZEN_AUTH_COSMOSDB_NAME,
);

const servicePreferenceModel = new ServicesPreferencesModel(
  cosmosApiDatabase.container(SERVICE_PREFERENCES_COLLECTION_NAME),
  SERVICE_PREFERENCES_COLLECTION_NAME,
);

const fetchApi = getFetchApi(config);
const sessionManagerInternalClient = buildSessionManagerInternalClient(
  fetchApi,
  config,
);
const functionProfileClient = buildFunctionProfileClient(fetchApi, config);

const HTML_TO_TEXT_OPTIONS: HtmlToTextOptions = {
  selectors: [{ selector: "img", format: "skip" }], // Ignore all document images
  tables: true,
};

const itnProfileEmailTableClient = TableClient.fromConnectionString(
  config.AZURE_STORAGE_CONNECTION_STRING_ITN,
  config.PROFILE_EMAIL_STORAGE_TABLE_NAME_ITN,
);

const profileModel = new ProfileModel(
  cosmosApiDatabase.container(PROFILE_COLLECTION_NAME),
);

const itnDataTableProfileEmailsRepository =
  new DataTableProfileEmailsRepository(itnProfileEmailTableClient);

const sessionNotificationsModel = new SessionNotificationsModel(
  citizenAuthDatabase.container(config.SESSION_NOTIFICATIONS_CONTAINER_NAME),
);

// -----------------------------------------------------------------
// EXTRA OUTPUTS
// -----------------------------------------------------------------

const spidLogsBlobOutput = output.storageBlob({
  connection: "IOPSTLOGS_STORAGE_CONNECTION_STRING",
  path: "spidassertions/{fiscalCode}-{createdAtDay}-{spidRequestId}-{loginType}.json",
});

// -----------------------------------------------------------------
// FUNCTION HANDLERS
// -----------------------------------------------------------------

const Info = InfoFunction({
  connectionString: config.AZURE_STORAGE_CONNECTION_STRING_ITN,
  cosmosApiDb: cosmosApiDatabase,
  citizenAuthDb: citizenAuthDatabase,
});

const ExpiredSessionAdvisor = ExpiredSessionAdvisorFunction({
  dryRunFeatureFlag: config.FF_DRY_RUN,
  expiredSessionEmailParameters: {
    from: config.MAIL_FROM,
    htmlToTextOptions: HTML_TO_TEXT_OPTIONS,
    title: "Importante: la tua sessione è scaduta." as NonEmptyString,
    ctaUrl: config.EXPIRED_SESSION_CTA_URL,
  },
})({
  sessionManagerInternalClient,
  functionProfileClient,
  inputDecoder: ExpiredSessionAdvisorQueueMessage,
  mailerTransporter: getMailerTransporter(config),
});

const MigrateServicePreferenceFromLegacy =
  MigrateServicePreferenceFromLegacyFunction({
    inputDecoder: MigrateServicesPreferencesQueueMessage,
    servicePreferencesRepository,
    tracker,
    servicePreferenceModel,
    telemetryClient,
  });

const OnProfileUpdateItn = OnProfileUpdateFunction({
  ProfileRepository,
  ProfileEmailRepository,
  TrackerRepository: tracker,
  profileModel,
  dataTableProfileEmailsRepository: itnDataTableProfileEmailsRepository,
  telemetryClient,
  inputDecoder: OnProfileUpdateFunctionInput,
});

const storeSpidLogsBaseHandler = StoreSpidLogsFunction({
  inputDecoder: StoreSpidLogsQueueMessage,
  spidLogsPublicKey: config.SPID_LOGS_PUBLIC_KEY,
  tracker,
  telemetryClient,
});

// Wrap the handler to route the blob output via context.extraOutputs (v4)
const StoreSpidLogs = async (
  queueItem: unknown,
  context: InvocationContext,
): Promise<void> => {
  const result = await storeSpidLogsBaseHandler(queueItem, context);
  if (result) {
    context.extraOutputs.set(spidLogsBlobOutput, result.spidRequestResponse);
  }
};

const ExpiredSessionsDiscoverer = ExpiredSessionsDiscovererFunction({
  SessionNotificationsRepo: SessionNotificationsRepository,
  ExpiredUserSessionsQueueRepo: ExpiredUserSessionsQueueRepository,
  expiredUserSessionsQueueClient,
  sessionNotificationsModel,
  expiredSessionsDiscovererConf: config,
  sessionNotificationsRepositoryConfig: config,
});

const SessionNotificationEventsProcessor =
  SessionNotificationEventsProcessorFunction({
    SessionNotificationsRepo: SessionNotificationsRepository,
    sessionNotificationEventsProcessorConfig: config,
    sessionNotificationsRepositoryConfig: config,
    sessionNotificationsModel,
  });

// -----------------------------------------------------------------
// REGISTER FUNCTIONS (Azure Functions v4 programming model)
// -----------------------------------------------------------------

app.http("Info", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "info",
  handler: Info,
});

app.storageQueue("ExpiredSessionAdvisor", {
  queueName: "%EXPIRED_SESSION_ADVISOR_QUEUE%",
  connection: "AZURE_STORAGE_CONNECTION_STRING_ITN",
  handler: ExpiredSessionAdvisor,
});

app.storageQueue("MigrateServicePreferenceFromLegacy", {
  queueName: "%MIGRATE_SERVICES_PREFERENCES_PROFILE_QUEUE_NAME%",
  connection: "MAINTENANCE_STORAGE_ACCOUNT_CONNECTION_STRING",
  handler: MigrateServicePreferenceFromLegacy,
});

app.storageQueue("StoreSpidLogs", {
  queueName: "spidmsgitems",
  connection: "IOPSTLOGS_STORAGE_CONNECTION_STRING",
  handler: StoreSpidLogs,
  extraOutputs: [spidLogsBlobOutput],
});

app.cosmosDB("OnProfileUpdateItn", {
  connection: "COSMOSDB_CONNECTION_STRING",
  databaseName: "%COSMOSDB_NAME%",
  containerName: "profiles",
  createLeaseContainerIfNotExists: true,
  leaseContainerName: "profile-emails-uniqueness-leases-itn-002",
  leaseContainerPrefix: "%ON_PROFILE_UPDATE_ITN_LEASES_PREFIX%-",
  feedPollDelay: 2500,
  startFromBeginning: true,
  handler: OnProfileUpdateItn,
  retry: {
    strategy: "exponentialBackoff",
    maxRetryCount: 5,
    minimumInterval: { seconds: 5 },
    maximumInterval: { minutes: 1 },
  },
});

app.timer("ExpiredSessionsDiscoverer", {
  schedule: "0 0 8 * * *",
  handler: ExpiredSessionsDiscoverer,
  retry: {
    strategy: "fixedDelay",
    maxRetryCount: 5,
    delayInterval: { minutes: 15 },
  },
});

app.serviceBusTopic("SessionNotificationEventsProcessor", {
  topicName: "%SERVICEBUS_AUTH_SESSION_TOPIC%",
  subscriptionName: "%SERVICEBUS_NOTIFICATION_EVENT_SUBSCRIPTION%",
  connection: "PLATFORM_SERVICEBUS_CONNECTION",
  isSessionsEnabled: true,
  handler: SessionNotificationEventsProcessor,
});
