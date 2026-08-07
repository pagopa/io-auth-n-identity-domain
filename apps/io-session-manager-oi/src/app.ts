import { TableClient } from "@azure/data-tables";
import { DefaultAzureCredential } from "@azure/identity";
import { QueueServiceClient } from "@azure/storage-queue";
import { TableClientWrapper } from "@pagopa/azure-sdk/data-tables";
import { FiscalCodeSchema } from "@pagopa/hexagonal-core";
import { type PackageInfo } from "@pagopa/io-package-info";
import {
  createRedisNodeClient,
  createRedisManagedIdentityNodeClient,
} from "@pagopa/redis/node-client";
import { RedisSetWrapper } from "@pagopa/redis/set-wrapper";
import fastify, { type FastifyInstance } from "fastify";

import { CosmosClient } from "@azure/cosmos";
import { SessionCosmosAdapter } from "@pagopa/io-auth-n-identity-session/adapters";
import { mountHealthCheckHandler } from "./adapters/inbound/fastify/health-check.handler.js";
import { mountReserveHandler } from "./adapters/inbound/fastify/reserve.handler.js";
import { mountCallbackHandler } from "./adapters/inbound/fastify/callback.handler.js";
import { AusiliarDataRedisAdapter } from "./adapters/outbound/ausiliar-data.adapter.js";
import { BlockedUsersRedisAdapter } from "./adapters/outbound/blocked-users-redis.adapter.js";
import { InMemoryOidcConfigAdapter } from "./adapters/outbound/in-memory-oidc-config.adapter.js";
import { createIoLollipopAdapter } from "./adapters/outbound/io-lollipop.adapter.js";
import { createIoProfileAdapter } from "./adapters/outbound/io-profile.adapter.js";
import { LockedProfilesDataTableAdapter } from "./adapters/outbound/locked-profiles-data-table.adapter.js";
import { NotificationStorageQueueAdapter } from "./adapters/outbound/notification-storage-queue.adapter.js";
import { OpenIdClientAdapter } from "./adapters/outbound/openid-client.adapter.js";
import { makeActivateUserSessionUseCase } from "./application/use-cases/activate-user-session.use-case.js";
import { getHealthCheckUseCase } from "./application/use-cases/health-check.use-case.js";
import { makeReserveUseCase } from "./application/use-cases/reserve.use-case.js";
import { type Config } from "./domain/value-objects/configs/index.js";
import { LoginAusiliarDataSchema } from "./domain/value-objects/login.vo.js";
import { RedisObjectWrapper } from "@pagopa/redis/object-wrapper";

class AzureCredential {
  private static instance: DefaultAzureCredential | undefined;

  private constructor() {}

  public static getInstance(): DefaultAzureCredential {
    if (!AzureCredential.instance) {
      AzureCredential.instance = new DefaultAzureCredential();
    }
    return AzureCredential.instance;
  }
}

export const createApp = async (
  config: Config,
  packageInfo: PackageInfo,
): Promise<{
  server: FastifyInstance;
}> => {
  const server = fastify({
    trustProxy: true, // Enable trust proxy to get correct client IPs behind proxies (necessary for check-ip hook)
  });

  const lockedProfilesTableClient =
    config.NODE_ENV === "production"
      ? new TableClient(
          config.LOCKED_PROFILES_STORAGE_ACCOUNT_URI,
          config.LOCKED_PROFILES_TABLE_NAME,
          AzureCredential.getInstance(),
        )
      : TableClient.fromConnectionString(
          config.LOCKED_PROFILES_STORAGE_CONNECTION_STRING,
          config.LOCKED_PROFILES_TABLE_NAME,
        );
  const lockedProfilesAdapter = new LockedProfilesDataTableAdapter(
    new TableClientWrapper(
      lockedProfilesTableClient,
      LockedProfilesDataTableAdapter.schema,
    ),
  );

  const pushNotificationsQueueServiceClient =
    config.NODE_ENV === "production"
      ? new QueueServiceClient(
          config.PUSH_NOTIFICATIONS_QUEUE_STORAGE_URI,
          AzureCredential.getInstance(),
        )
      : QueueServiceClient.fromConnectionString(
          config.PUSH_NOTIFICATIONS_STORAGE_CONNECTION_STRING,
        );
  const notificationStorageQueueAdapter = new NotificationStorageQueueAdapter(
    pushNotificationsQueueServiceClient.getQueueClient(
      config.PUSH_NOTIFICATIONS_QUEUE_NAME,
    ),
  );

  const redisClient =
    config.NODE_ENV === "production"
      ? await createRedisManagedIdentityNodeClient(
          {
            hostname: config.REDIS_HOSTNAME,
            port: config.REDIS_PORT,
            enableTls: config.REDIS_TLS_ENABLED,
          },
          AzureCredential.getInstance(),
        )
      : await createRedisNodeClient({
          hostname: config.REDIS_HOSTNAME,
          password: config.REDIS_PASSWORD,
          port: config.REDIS_PORT,
          enableTls: config.REDIS_TLS_ENABLED,
        });

  // Close the Redis connection cleanly when Fastify shuts down (via
  // `server.close()`). `close()` waits for pending commands to
  // complete and drains the socket, avoiding leaked descriptors on
  // redeploy.
  server.addHook("onClose", async () => {
    try {
      await redisClient.close();
    } catch (err) {
      server.log.warn({ err }, "Failed to close Redis client gracefully");
    }
  });

  const blockedUsersAdapter = new BlockedUsersRedisAdapter(
    // Both generics are inferred from the constructor arguments:
    // `TSchema` from `FiscalCodeSchema` and `TClient` from `redisClient`.
    new RedisSetWrapper(redisClient, FiscalCodeSchema),
  );

  const cosmosClient =
    config.NODE_ENV === "production"
      ? new CosmosClient({
          endpoint: config.COSMOSDB_URI,
          aadCredentials: AzureCredential.getInstance(),
        })
      : new CosmosClient(config.COSMOSDB_CONNECTION_STRING);

  const sessionCosmosAdapter = new SessionCosmosAdapter(
    cosmosClient,
    config.COSMOSDB_NAME,
    config.COSMOSDB_SESSION_TOKEN_CONTAINER_NAME,
    config.COSMOSDB_ACTIVE_SESSION_CONTAINER_NAME,
  );

  const ausiliarStorageAdapter = new AusiliarDataRedisAdapter(
    new RedisObjectWrapper(redisClient, LoginAusiliarDataSchema),
  );

  const fetchLollipopAdapter = createIoLollipopAdapter({
    baseUrl: `${config.LOLLIPOP_API_URL}${config.LOLLIPOP_API_BASE_PATH}`,
    apiKey: config.LOLLIPOP_API_KEY,
  });

  const profileAdapter = createIoProfileAdapter({
    baseUrl: `${config.IO_PROFILE_API_URL}${config.IO_PROFILE_API_BASE_PATH}`,
    apiKey: config.IO_PROFILE_API_KEY,
  });

  const oidcConfigAdapter = new InMemoryOidcConfigAdapter({
    ONEID_PROD_CLIENT_ID: config.ONEID_PROD_CLIENT_ID,
    ONEID_PROD_CLIENT_SECRET: config.ONEID_PROD_CLIENT_SECRET,
    ONEID_PROD_ISSUER: config.ONEID_PROD_ISSUER,
    ONEID_PROD_REDIRECT_URI: config.ONEID_PROD_REDIRECT_URI,
    ONEID_UAT_CLIENT_ID: config.ONEID_UAT_CLIENT_ID,
    ONEID_UAT_CLIENT_SECRET: config.ONEID_UAT_CLIENT_SECRET,
    ONEID_UAT_ISSUER: config.ONEID_UAT_ISSUER,
  });

  const oidcExchangeAdapter = new OpenIdClientAdapter(oidcConfigAdapter);

  // Warm up OIDC discovery (metadata + JWKS) so the cost is paid at startup
  // Best-effort: never blocks boot on a provider outage — the lazy path retries on demand.
  await oidcExchangeAdapter.warmUp(["PROD", "UAT"]);

  const reserveUseCase = makeReserveUseCase({
    ausiliarDataPort: ausiliarStorageAdapter,
    lollipopPort: fetchLollipopAdapter,
    oidcConfigPort: oidcConfigAdapter,
  });

  const activateUserSessionUseCase = makeActivateUserSessionUseCase(
    sessionCosmosAdapter,
    profileAdapter,
  );

  // --------------------------------------------------
  // Endpoints mounting
  // --------------------------------------------------

  mountHealthCheckHandler("liveness")(
    server,
    getHealthCheckUseCase(packageInfo),
  );

  mountHealthCheckHandler("readiness")(
    server,
    getHealthCheckUseCase(packageInfo, [
      {
        name: lockedProfilesAdapter.constructor.name,
        port: lockedProfilesAdapter,
      },
      {
        name: notificationStorageQueueAdapter.constructor.name,
        port: notificationStorageQueueAdapter,
      },
      {
        name: blockedUsersAdapter.constructor.name,
        port: blockedUsersAdapter,
      },
      {
        name: ausiliarStorageAdapter.constructor.name,
        port: ausiliarStorageAdapter,
      },
    ]),
  );

  mountReserveHandler(server, reserveUseCase);

  mountCallbackHandler(server, {
    ausiliarDataPort: ausiliarStorageAdapter,
    oidcExchangePort: oidcExchangeAdapter,
    activateUserSessionUseCase,
    loginSuccessRedirectUrl: config.LOGIN_SUCCESS_REDIRECT_URL,
  });

  return { server };
};
