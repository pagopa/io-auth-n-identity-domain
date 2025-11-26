import { app } from "@azure/functions";
import { TableClient } from "@azure/data-tables";
import { DefaultAzureCredential } from "@azure/identity";
import { QueueClient } from "@azure/storage-queue";
import { AuthSessionsTopicRepository } from "@pagopa/io-auth-n-identity-commons/repositories/auth-sessions-topic-repository";
import { ServiceBusClient } from "@azure/service-bus";
import { BlobServiceClient } from "@azure/storage-blob";
import { BlobUtil } from "@pagopa/io-auth-n-identity-commons/utils/storage-blob";
import { CreateRedisClientSingleton } from "../utils/redis-client";
import { initTelemetryClient } from "../utils/appinsights";
import { getConfigOrThrow } from "../utils/config";
import { AuthLockRepository } from "../repositories/auth-lock";
import { InstallationRepository } from "../repositories/installation";
import { LollipopRepository } from "../repositories/lollipop";
import { Package } from "../repositories/package";
import { RedisRepository } from "../repositories/redis";
import { BlockedUsersRedisRepository } from "../repositories/blocked-users-redis";
import { InfoService } from "../services/info";
import { SessionService } from "../services/session-service";
import { BlockedUsersService } from "../services/blocked-users-service";
import { RejectedLoginAuditLogService } from "../services/rejected-login-audit-log-service";
import { InfoFunction } from "./info";
import { GetSessionFunction, GetSessionStateFunction } from "./get-session";
import { UnlockUserSessionFunction } from "./unlock-user-session";
import { LockUserSessionFunction } from "./lock-user-session";
import {
  AuthLockFunction,
  DeleteUserSessionFunction,
  ReleaseAuthLockFunction,
} from "./auth-lock";
import { RejectedLoginEventProcessorFunction } from "./rejected-login-event-processor";
import { RejectedLoginEvent } from "@pagopa/io-auth-n-identity-commons/types/session-events/rejected-login-event";

const v1BasePath = "api/v1";
const config = getConfigOrThrow();

const appInsightsTelemetryClient = initTelemetryClient();

const fastRedisClientTask = CreateRedisClientSingleton(
  config,
  true,
  config.APPINSIGHTS_REDIS_TRACE_ENABLED,
  appInsightsTelemetryClient,
);
const safeRedisClientTask = CreateRedisClientSingleton(
  config,
  false,
  config.APPINSIGHTS_REDIS_TRACE_ENABLED,
  appInsightsTelemetryClient,
);

const AuthenticationLockTableClient = TableClient.fromConnectionString(
  config.LOCKED_PROFILES_STORAGE_CONNECTION_STRING,
  config.LOCKED_PROFILES_TABLE_NAME,
);

const RevokeAssertionRefQueueClient = new QueueClient(
  config.LOLLIPOP_REVOKE_STORAGE_CONNECTION_STRING,
  config.LOLLIPOP_REVOKE_QUEUE_NAME,
);

const NotificationQueueClient = new QueueClient(
  config.PUSH_NOTIFICATIONS_STORAGE_CONNECTION_STRING,
  config.PUSH_NOTIFICATIONS_QUEUE_NAME,
);

const serviceBusClient = config.SERVICE_BUS_CONNECTION
  ? new ServiceBusClient(config.SERVICE_BUS_CONNECTION) // Use the development connection string if provided, otherwise use the DefaultAzureCredential
  : new ServiceBusClient(
      config.SERVICE_BUS_NAMESPACE,
      new DefaultAzureCredential(),
    );

const authSessionsTopicServiceBusSender = serviceBusClient.createSender(
  config.AUTH_SESSIONS_TOPIC_NAME,
);

const auditBlobServiceClient = BlobServiceClient.fromConnectionString(
  config.AUDIT_LOG_STORAGE_CONNECTION_STRING,
);

app.http("Info", {
  authLevel: "anonymous",
  handler: InfoFunction({ InfoService, Package }),
  methods: ["GET"],
  route: `${v1BasePath}/info`,
});

app.http("GetSession", {
  authLevel: "function",
  handler: GetSessionFunction({
    FastRedisClientTask: fastRedisClientTask,
    SafeRedisClientTask: safeRedisClientTask,
    SessionService,
    RedisRepository,
  }),
  methods: ["GET"],
  route: `${v1BasePath}/sessions/{fiscalCode}`,
});

// ////////////////////////// //
//  IO-WEB PROFILE FEATURES  //
// ///////////////////////// //
app.http("GetUserSessionState", {
  authLevel: "function",
  handler: GetSessionStateFunction({
    SafeRedisClientTask: safeRedisClientTask,
    SessionService,
    RedisRepository,
    AuthLockRepository,
    AuthenticationLockTableClient,
  }),
  methods: ["GET"],
  route: `${v1BasePath}/sessions/{fiscalCode}/state`,
});

app.http("AuthLock", {
  authLevel: "function",
  handler: AuthLockFunction({
    FastRedisClientTask: fastRedisClientTask,
    SafeRedisClientTask: safeRedisClientTask,
    SessionService,
    RedisRepository,
    AuthLockRepository,
    InstallationRepository,
    LollipopRepository,
    NotificationQueueClient,
    AuthenticationLockTableClient,
    RevokeAssertionRefQueueClient,
    AuthSessionsTopicRepository,
    authSessionsTopicSender: authSessionsTopicServiceBusSender,
  }),
  methods: ["POST"],
  route: `${v1BasePath}/auth/{fiscalCode}/lock`,
});

app.http("ReleaseAuthLock", {
  authLevel: "function",
  handler: ReleaseAuthLockFunction({
    SessionService,
    AuthLockRepository,
    AuthenticationLockTableClient,
  }),
  methods: ["POST"],
  route: `${v1BasePath}/auth/{fiscalCode}/release-lock`,
});

app.http("DeleteUserSession", {
  authLevel: "function",
  handler: DeleteUserSessionFunction({
    FastRedisClientTask: fastRedisClientTask,
    SafeRedisClientTask: safeRedisClientTask,
    SessionService,
    RedisRepository,
    LollipopRepository,
    RevokeAssertionRefQueueClient,
    AuthSessionsTopicRepository,
    authSessionsTopicSender: authSessionsTopicServiceBusSender,
  }),
  methods: ["POST"],
  route: `${v1BasePath}/sessions/{fiscalCode}/logout`,
});

// //////////////////////////////

const blockedUserServiceDeps = {
  blockedUsersService: BlockedUsersService,
  blockedUserRedisRepository: BlockedUsersRedisRepository,
  fastRedisClientTask,
  safeRedisClientTask,
  sessionService: SessionService,
  lollipopRepository: LollipopRepository,
  redisRepository: RedisRepository,
  RevokeAssertionRefQueueClient,
  AuthSessionsTopicRepository,
  authSessionsTopicSender: authSessionsTopicServiceBusSender,
};

app.http("LockUserSession", {
  authLevel: "function",
  handler: LockUserSessionFunction(blockedUserServiceDeps),
  methods: ["POST"],
  route: `${v1BasePath}/sessions/{fiscalCode}/lock`,
});

app.http("UnlockUserSession", {
  authLevel: "function",
  handler: UnlockUserSessionFunction(blockedUserServiceDeps),
  methods: ["DELETE"],
  route: `${v1BasePath}/sessions/{fiscalCode}/lock`,
});

app.serviceBusTopic("RejectedLoginEventProcessor", {
  topicName: config.AUTH_SESSIONS_TOPIC_NAME,
  subscriptionName: config.REJECTED_LOGIN_TOPIC_SUBSCRIPTION_NAME,
  handler: RejectedLoginEventProcessorFunction({
    inputDecoder: RejectedLoginEvent,
    rejectedLoginAuditLogService: RejectedLoginAuditLogService,
    auditBlobServiceClient,
    auditLogConfig: config,
    blobUtil: BlobUtil,
  }),
  connection: "SERVICE_BUS_CONNECTION",
});
