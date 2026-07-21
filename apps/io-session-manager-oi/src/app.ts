import { TableClient } from "@azure/data-tables";
import { DefaultAzureCredential } from "@azure/identity";
import { TableClientWrapper } from "@pagopa/azure-sdk/data-tables";
import { type PackageInfo } from "@pagopa/io-package-info";
import fastify, { type FastifyInstance } from "fastify";

import { mountHealthCheckHandler } from "./adapters/inbound/fastify/health-check.handler.js";
import {
  LockedProfileDataTableSchema,
  LockedProfilesDataTableAdapter,
} from "./adapters/outbound/locked-profiles-data-table.adapter.js";
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

export const createApp = (
  config: Config,
  packageInfo: PackageInfo,
): {
  server: FastifyInstance;
} => {
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
      LockedProfileDataTableSchema,
    ),
  );

  mountHealthCheckHandler(
    server,
    getHealthCheckUseCase(packageInfo, [
      {
        name: lockedProfilesAdapter.constructor.name,
        port: lockedProfilesAdapter,
      },
    ]),
  );

  return { server };
};
