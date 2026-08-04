import { TableClient } from "@azure/data-tables";
import { QueueServiceClient } from "@azure/storage-queue";
import { TableClientWrapper } from "@pagopa/azure-sdk/data-tables";
import { FiscalCodeSchema } from "@pagopa/hexagonal-core";
import { type PackageInfo } from "@pagopa/io-package-info";
import { createRedisNodeClient } from "@pagopa/redis/node-client";
import { RedisSetWrapper } from "@pagopa/redis/set-wrapper";
import fastify, { type FastifyInstance } from "fastify";

import { mountHealthCheckHandler } from "../adapters/inbound/fastify/health-check.handler.js";
import { BlockedUsersRedisAdapter } from "../adapters/outbound/blocked-users-redis.adapter.js";
import { LockedProfilesDataTableAdapter } from "../adapters/outbound/locked-profiles-data-table.adapter.js";
import { NotificationStorageQueueAdapter } from "../adapters/outbound/notification-storage-queue.adapter.js";
import { getHealthCheckUseCase } from "../application/use-cases/health-check.use-case.js";
import { type DevelopmentConfig } from "../domain/value-objects/configs/index.js";

export const createDevelopmentApp = async (
  config: DevelopmentConfig,
  packageInfo: PackageInfo,
): Promise<{
  server: FastifyInstance;
}> => {
  const server = fastify();

  const lockedProfilesTableClient = TableClient.fromConnectionString(
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
    QueueServiceClient.fromConnectionString(
      config.PUSH_NOTIFICATIONS_STORAGE_CONNECTION_STRING,
    );
  const pushNotificationStorageQueueAdapter =
    new NotificationStorageQueueAdapter(
      pushNotificationsQueueServiceClient.getQueueClient(
        config.PUSH_NOTIFICATIONS_QUEUE_NAME,
      ),
    );

  const redisClient = await createRedisNodeClient({
    hostname: config.REDIS_HOSTNAME,
    password: config.REDIS_PASSWORD,
    port: config.REDIS_PORT,
    enableTls: config.REDIS_TLS_ENABLED,
  });
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
    ]),
  );

  return { server };
};
