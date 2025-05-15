import { app } from "@azure/functions";
import { TableClient } from "@azure/data-tables";
import { QueueClient } from "@azure/storage-queue";
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
import { InfoFunction } from "./info";
import { GetSessionFunction } from "./get-session";
import { UnlockUserSessionFunction } from "./unlock-user-session";
import { LockUserSessionFunction } from "./lock-user-session";
import { AuthLockFunction, ReleaseAuthLockFunction } from "./auth-lock";

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

const blockedUserServiceDeps = {
  blockedUsersService: BlockedUsersService,
  blockedUserRedisRepository: BlockedUsersRedisRepository,
  fastRedisClientTask,
  safeRedisClientTask,
  sessionService: SessionService,
  lollipopRepository: LollipopRepository,
  redisRepository: RedisRepository,
  RevokeAssertionRefQueueClient,
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
