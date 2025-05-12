import { app } from "@azure/functions";
import { TableClient } from "@azure/data-tables";
import { QueueClient } from "@azure/storage-queue";
import { InfoService } from "../services/info";
import { Package } from "../repositories/package";
import { CreateRedisClientSingleton } from "../utils/redis-client";
import { getConfigOrThrow } from "../utils/config";
import { SessionService } from "../services/session-service";
import { RedisRepository } from "../repositories/redis";
import { initTelemetryClient } from "../utils/appinsights";
import { AuthLockRepository } from "../repositories/auth-lock";
import { InstallationRepository } from "../repositories/installation";
import { LollipopRepository } from "../repositories/lollipop";
import { InfoFunction } from "./info";
import { GetSessionFunction } from "./get-session";
import { AuthLockFunction } from "./auth-lock";

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
  }),
  methods: ["POST"],
  route: `${v1BasePath}/auth/{fiscalCode}/lock`,
});
