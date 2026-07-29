import { TableClient } from "@azure/data-tables";
import { DefaultAzureCredential } from "@azure/identity";
import { TableClientWrapper } from "@pagopa/azure-sdk/data-tables";
import { FiscalCode, FiscalCodeSchema } from "@pagopa/hexagonal-core";
import { type PackageInfo } from "@pagopa/io-package-info";
import { RedisNodeClient, RedisSetWrapper } from "@pagopa/redis/client";
import { createRedisNodeClient } from "@pagopa/redis/node-client";
import fastify, { type FastifyInstance } from "fastify";

import { mountHealthCheckHandler } from "./adapters/inbound/fastify/health-check.handler.js";
import { BlockedUsersRedisAdapter } from "./adapters/outbound/blocked-users-redis.adapter.js";
import { LockedProfilesDataTableAdapter } from "./adapters/outbound/locked-profiles-data-table.adapter.js";
import { getHealthCheckUseCase } from "./application/use-cases/health-check.use-case.js";
import { type Config } from "./domain/value-objects/config.vo.js";

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

  const redisClient = await createRedisNodeClient({
    url: config.REDIS_URL,
    port: config.REDIS_PORT,
    password: config.REDIS_PASSWORD,
    enableTls: config.REDIS_TLS_ENABLED,
  });

  const blockedUsersAdapter = new BlockedUsersRedisAdapter(
    new RedisSetWrapper<FiscalCode, RedisNodeClient>(
      redisClient,
      FiscalCodeSchema,
    ),
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
      /*
       * TODO:
       * Uncomment this when the blocked users adapter is ready to be used in the health check.
       * The password for the Redis instance is currently not available in the environment, so the health check will fail.
       */
       
      // {
      //   name: blockedUsersAdapter.constructor.name,
      //   port: blockedUsersAdapter,
      // },
    ]),
  );

  return { server };
};
