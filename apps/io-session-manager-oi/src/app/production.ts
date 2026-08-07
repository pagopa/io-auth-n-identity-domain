import { CosmosClient } from "@azure/cosmos";
import { TableClient } from "@azure/data-tables";
import { DefaultAzureCredential } from "@azure/identity";
import { QueueServiceClient } from "@azure/storage-queue";
import { TableClientWrapper } from "@pagopa/azure-sdk/data-tables";
import { FiscalCodeSchema } from "@pagopa/hexagonal-core";
import { SessionCosmosAdapter } from "@pagopa/io-auth-n-identity-session/adapters";
import { type PackageInfo } from "@pagopa/io-package-info";
import { createRedisManagedIdentityNodeClient } from "@pagopa/redis/node-client";
import { RedisObjectWrapper } from "@pagopa/redis/object-wrapper";
import { RedisSetWrapper } from "@pagopa/redis/set-wrapper";
import fastify, { type FastifyInstance } from "fastify";


import { mountHealthCheckHandler } from "../adapters/inbound/fastify/health-check.handler.js";
import { mountReserveHandler } from "../adapters/inbound/fastify/reserve.handler.js";
import { AusiliarDataRedisAdapter } from "../adapters/outbound/ausiliar-data.adapter.js";
import { BlockedUsersRedisAdapter } from "../adapters/outbound/blocked-users-redis.adapter.js";
import { InMemoryOidcConfigAdapter } from "../adapters/outbound/in-memory-oidc-config.adapter.js";
import { createIoLollipopAdapter } from "../adapters/outbound/io-lollipop.adapter.js";
import { LockedProfilesDataTableAdapter } from "../adapters/outbound/locked-profiles-data-table.adapter.js";
import { NotificationStorageQueueAdapter } from "../adapters/outbound/notification-storage-queue.adapter.js";
import { getHealthCheckUseCase } from "../application/use-cases/health-check.use-case.js";
import { makeReserveUseCase } from "../application/use-cases/reserve.use-case.js";
import { type ProductionConfig } from "../domain/value-objects/configs/index.js";
import { LoginAusiliarDataSchema } from "../domain/value-objects/login.vo.js";

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

export const createProductionApp = async (
  config: ProductionConfig,
  packageInfo: PackageInfo,
): Promise<{
  server: FastifyInstance;
}> => {
  const server = fastify({
    trustProxy: true, // Enable trust proxy to get correct client IPs behind proxies (necessary for check-ip hook)
  });

  const lockedProfilesTableClient = new TableClient(
    config.LOCKED_PROFILES_STORAGE_ACCOUNT_URI,
    config.LOCKED_PROFILES_TABLE_NAME,
    AzureCredential.getInstance(),
  );
  const lockedProfilesAdapter = new LockedProfilesDataTableAdapter(
    new TableClientWrapper(
      lockedProfilesTableClient,
      LockedProfilesDataTableAdapter.schema,
    ),
  );

  const pushNotificationsQueueServiceClient = new QueueServiceClient(
    config.PUSH_NOTIFICATIONS_QUEUE_STORAGE_URI,
    AzureCredential.getInstance(),
  );
  const pushNotificationStorageQueueAdapter =
    new NotificationStorageQueueAdapter(
      pushNotificationsQueueServiceClient.getQueueClient(
        config.PUSH_NOTIFICATIONS_QUEUE_NAME,
      ),
    );

  const redisClient = await createRedisManagedIdentityNodeClient(
    {
      hostname: config.REDIS_HOSTNAME,
      port: config.REDIS_PORT,
      enableTls: config.REDIS_TLS_ENABLED,
    },
    AzureCredential.getInstance(),
  );
  server.addHook("onClose", async () => {
    try {
      await redisClient.close();
    } catch (err) {
      server.log.warn({ err }, "Failed to close Redis client gracefully");
    }
  });

  const blockedUsersAdapter = new BlockedUsersRedisAdapter(
    new RedisSetWrapper(redisClient, FiscalCodeSchema),
  );

  const cosmosClient = new CosmosClient({
    endpoint: config.COSMOSDB_URI,
    aadCredentials: AzureCredential.getInstance(),
  });

  // TODO: wire into endpoints
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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

  const oidcConfigAdapter = new InMemoryOidcConfigAdapter({
    ONEID_PROD_CLIENT_ID: config.ONEID_PROD_CLIENT_ID,
    ONEID_PROD_ISSUER: config.ONEID_PROD_ISSUER,
    ONEID_PROD_REDIRECT_URI: config.ONEID_PROD_REDIRECT_URI,
    ONEID_UAT_CLIENT_ID: config.ONEID_UAT_CLIENT_ID,
    ONEID_UAT_ISSUER: config.ONEID_UAT_ISSUER,
  });

  const reserveUseCase = makeReserveUseCase({
    ausiliarDataPort: ausiliarStorageAdapter,
    lollipopPort: fetchLollipopAdapter,
    oidcConfigPort: oidcConfigAdapter,
  });

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
        name: pushNotificationStorageQueueAdapter.constructor.name,
        port: pushNotificationStorageQueueAdapter,
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
  return { server };
};
