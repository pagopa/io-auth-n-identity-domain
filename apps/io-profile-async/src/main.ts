import { CosmosClient } from "@azure/cosmos";
import { QueueClient } from "@azure/storage-queue";

import { TableClient } from "@azure/data-tables";
import { getMailerTransporter } from "@pagopa/io-functions-commons/dist/src/mailer";
import {
  PROFILE_COLLECTION_NAME,
  ProfileModel
} from "@pagopa/io-functions-commons/dist/src/models/profile";
import {
  SERVICE_PREFERENCES_COLLECTION_NAME,
  ServicesPreferencesModel
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
  MigrateServicesPreferencesQueueMessage
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
import { SessionNotificationsInitRecoveryFunction } from "./functions/session-notification-init-recovery";

const config = getConfigOrThrow();

const telemetryClient = initTelemetryClient();

const expiredUserSessionsQueueClient = new QueueClient(
  config.AZURE_STORAGE_CONNECTION_STRING,
  config.EXPIRED_SESSION_ADVISOR_QUEUE
);

const comsosApiCosmosClient = new CosmosClient(
  config.COSMOSDB_CONNECTION_STRING
);
const cosmosApiDatabase = comsosApiCosmosClient.database(config.COSMOSDB_NAME);

const citizenAuthCosmosClient = new CosmosClient(
  config.CITIZEN_AUTH_COSMOSDB_CONNECTION_STRING
);
const citizenAuthDatabase = citizenAuthCosmosClient.database(
  config.CITIZEN_AUTH_COSMOSDB_NAME
);

const servicePreferenceModel = new ServicesPreferencesModel(
  cosmosApiDatabase.container(SERVICE_PREFERENCES_COLLECTION_NAME),
  SERVICE_PREFERENCES_COLLECTION_NAME
);

const fetchApi = getFetchApi(config);
const sessionManagerInternalClient = buildSessionManagerInternalClient(
  fetchApi,
  config
);
const functionProfileClient = buildFunctionProfileClient(fetchApi, config);

const HTML_TO_TEXT_OPTIONS: HtmlToTextOptions = {
  selectors: [{ selector: "img", format: "skip" }], // Ignore all document images
  tables: true
};

const profileEmailTableClient = TableClient.fromConnectionString(
  config.AZURE_STORAGE_CONNECTION_STRING,
  config.PROFILE_EMAIL_STORAGE_TABLE_NAME
);

const profileModel = new ProfileModel(
  cosmosApiDatabase.container(PROFILE_COLLECTION_NAME)
);

const dataTableProfileEmailsRepository = new DataTableProfileEmailsRepository(
  profileEmailTableClient
);

const sessionNotificationsModel = new SessionNotificationsModel(
  citizenAuthDatabase.container(config.SESSION_NOTIFICATIONS_CONTAINER_NAME)
);

export const Info = InfoFunction({
  connectionString: config.AZURE_STORAGE_CONNECTION_STRING,
  cosmosApiDb: cosmosApiDatabase,
  citizenAuthDb: citizenAuthDatabase
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
  sessionManagerInternalClient,
  functionProfileClient,
  inputDecoder: ExpiredSessionAdvisorQueueMessage,
  mailerTransporter: getMailerTransporter(config)
});

export const MigrateServicePreferenceFromLegacy = MigrateServicePreferenceFromLegacyFunction(
  {
    inputDecoder: MigrateServicesPreferencesQueueMessage,
    servicePreferencesRepository,
    tracker,
    servicePreferenceModel,
    telemetryClient
  }
);

export const OnProfileUpdate = OnProfileUpdateFunction({
  ProfileRepository,
  ProfileEmailRepository,
  TrackerRepository: tracker,
  profileModel,
  dataTableProfileEmailsRepository,
  telemetryClient,
  inputDecoder: OnProfileUpdateFunctionInput
});

export const StoreSpidLogs = StoreSpidLogsFunction({
  inputDecoder: StoreSpidLogsQueueMessage,
  spidLogsPublicKey: config.SPID_LOGS_PUBLIC_KEY,
  tracker,
  telemetryClient
});

export const ExpiredSessionsDiscoverer = ExpiredSessionsDiscovererFunction({
  SessionNotificationsRepo: SessionNotificationsRepository,
  ExpiredUserSessionsQueueRepo: ExpiredUserSessionsQueueRepository,
  expiredUserSessionsQueueClient,
  sessionNotificationsModel,
  expiredSessionsDiscovererConf: config,
  sessionNotificationsRepositoryConfig: config
});

export const SessionNotificationEventsProcessor = SessionNotificationEventsProcessorFunction(
  {
    SessionNotificationsRepo: SessionNotificationsRepository,
    sessionNotificationEventsProcessorConfig: config,
    sessionNotificationsRepositoryConfig: config,
    sessionNotificationsModel
  }
);

export const SessionNotificationsInitRecovery = SessionNotificationsInitRecoveryFunction(
  {
    sessionManagerInternalClient,
    inputDecoder: ExpiredSessionAdvisorQueueMessage,
    SessionNotificationsRepo: SessionNotificationsRepository,
    sessionNotificationsRepositoryConfig: config,
    sessionNotificationsModel
  }
);
