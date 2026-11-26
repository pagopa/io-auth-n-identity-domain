import { CosmosClient } from "@azure/cosmos";
import { TableClient } from "@azure/data-tables";
import { DefaultAzureCredential } from "@azure/identity";
import { ServiceBusClient } from "@azure/service-bus";
import { QueueServiceClient } from "@azure/storage-queue";
import { TableClientWrapper } from "@pagopa/azure-sdk/data-tables";
import {
  LollipopActivationCosmosAdapter,
  SessionCosmosAdapter,
} from "@pagopa/io-auth-n-identity-session";
import type { PackageInfo } from "@pagopa/io-package-info";
import {
  AuthEventServiceBusAdapter,
  createPlatformInternalAdapter,
  LollipopRevocationQueueAdapter,
  makeInvalidatePreviousUserStateUseCase,
  TechnicalLockedProfilesDataTableAdapter,
} from "@pagopa/io-session-manager-core";
import fastify, { type FastifyInstance } from "fastify";

import { mountGetSessionStateHandler } from "./adapters/inbound/fastify/get-session-state.handler.js";
import { mountGetSessionHandler } from "./adapters/inbound/fastify/get-session.handler.js";
import { mountHealthCheckHandler } from "./adapters/inbound/fastify/health-check.handler.js";
import { mountTechnicalLockUserSessionHandler } from "./adapters/inbound/fastify/technical-lock-user-session.handler.js";
import { mountTechnicalUnlockUserSessionHandler } from "./adapters/inbound/fastify/technical-unlock-user-session.handler.js";
import { makeGetSessionStateUseCase } from "./application/use-cases/get-session-state.use-case.js";
import { makeGetSessionUseCase } from "./application/use-cases/get-session.use-case.js";
import { getHealthCheckUseCase } from "./application/use-cases/health-check.use-case.js";
import { makeTechnicalLockUserSessionUseCase } from "./application/use-cases/technical-lock-user-session.use-case.js";
import { makeTechnicalUnlockUserSessionUseCase } from "./application/use-cases/technical-unlock-user-session.use-case.js";
import type { Config } from "./domain/value-objects/configs/index.js";

const CLEANUP_TIMEOUT_MS = 2_000;

const createResourceLifecycle = (server: FastifyInstance) => {
  const cleanups: { name: string; close: () => unknown }[] = [];
  let cleanupPromise: Promise<void> | undefined;

  const closeResource = async (name: string, close: () => unknown) => {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        Promise.resolve().then(close),
        new Promise<never>((_resolve, reject) => {
          timeout = setTimeout(
            () => reject(new Error(`Cleanup timed out for ${name}`)),
            CLEANUP_TIMEOUT_MS,
          );
        }),
      ]);
    } catch (error) {
      server.log.warn({ err: error }, `Failed to clean up ${name}`);
    } finally {
      clearTimeout(timeout);
    }
  };

  const cleanupResources = (): Promise<void> => {
    cleanupPromise ??= Promise.resolve().then(async () => {
      for (const resource of [...cleanups].reverse()) {
        await closeResource(resource.name, resource.close);
      }
    });
    return cleanupPromise;
  };

  return {
    registerCleanup: (name: string, close: () => unknown) => {
      cleanups.push({ name, close });
    },
    cleanupResources,
    closeServer: () => closeResource("Fastify server", () => server.close()),
  };
};

/** Provides a lazily initialized credential shared by the Azure clients. */
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

/**
 * Creates infrastructure clients for the application.
 *
 * @param config - Application configuration.
 * @param registerCleanup - Resource cleanup registration callback.
 * @returns The initialized infrastructure clients.
 */
const createClients = (
  config: Config,
  registerCleanup: ReturnType<
    typeof createResourceLifecycle
  >["registerCleanup"],
) => {
  const cosmosClient =
    config.NODE_ENV === "production"
      ? new CosmosClient({
          endpoint: config.COSMOSDB_URI,
          aadCredentials: AzureCredential.getInstance(),
        })
      : new CosmosClient(config.COSMOSDB_CONNECTION_STRING);
  registerCleanup("Cosmos client", () => cosmosClient.dispose());

  const lollipopRevocationQueueServiceClient =
    config.NODE_ENV === "production"
      ? new QueueServiceClient(
          config.LOLLIPOP_REVOCATION_QUEUE_STORAGE_URI,
          AzureCredential.getInstance(),
        )
      : QueueServiceClient.fromConnectionString(
          config.LOLLIPOP_REVOCATION_QUEUE_STORAGE_CONNECTION_STRING,
        );

  const technicalLockedProfilesTableClient =
    config.NODE_ENV === "production"
      ? new TableClient(
          config.TECHNICAL_LOCKED_PROFILES_STORAGE_ACCOUNT_URI,
          config.TECHNICAL_LOCKED_PROFILES_TABLE_NAME,
          AzureCredential.getInstance(),
        )
      : TableClient.fromConnectionString(
          config.TECHNICAL_LOCKED_PROFILES_STORAGE_CONNECTION_STRING,
          config.TECHNICAL_LOCKED_PROFILES_TABLE_NAME,
          { allowInsecureConnection: config.NODE_ENV === "development" },
        );

  const serviceBusClient =
    config.NODE_ENV === "production"
      ? new ServiceBusClient(
          config.SERVICE_BUS_HOSTNAME,
          AzureCredential.getInstance(),
        )
      : new ServiceBusClient(config.SERVICE_BUS_CONNECTION_STRING);
  registerCleanup("Service Bus client", () => serviceBusClient.close());

  return {
    cosmosClient,
    lollipopRevocationQueueServiceClient,
    technicalLockedProfilesTableClient,
    serviceBusClient,
  };
};

/**
 * Creates and initializes outbound adapters.
 *
 * @param config - Application configuration.
 * @param clients - Infrastructure clients.
 * @returns The initialized outbound adapters.
 */
const createAdapters = async (
  config: Config,
  clients: Awaited<ReturnType<typeof createClients>>,
) => {
  const authEventServiceBusAdapter = new AuthEventServiceBusAdapter(
    clients.serviceBusClient.createSender(config.AUTH_SESSIONS_TOPIC_NAME),
  );

  const lollipopActivationCosmosAdapter = new LollipopActivationCosmosAdapter(
    clients.cosmosClient,
    config.COSMOSDB_NAME,
    config.COSMOSDB_LOLLIPOP_ACTIVATION_CONTAINER_NAME,
  );

  const lollipopRevocationQueueAdapter = new LollipopRevocationQueueAdapter(
    clients.lollipopRevocationQueueServiceClient.getQueueClient(
      config.LOLLIPOP_REVOCATION_QUEUE_NAME,
    ),
  );

  const platformInternalAdapter = createPlatformInternalAdapter({
    baseUrl: new URL(
      config.PLATFORM_PROXY_API_BASE_PATH,
      config.PLATFORM_PROXY_API_URL,
    ),
  });

  const sessionCosmosAdapter = new SessionCosmosAdapter(
    clients.cosmosClient,
    config.COSMOSDB_NAME,
    config.COSMOSDB_SESSION_TOKEN_CONTAINER_NAME,
    config.COSMOSDB_ACTIVE_SESSION_CONTAINER_NAME,
  );

  const technicalLockedProfilesAdapter =
    new TechnicalLockedProfilesDataTableAdapter(
      new TableClientWrapper(
        clients.technicalLockedProfilesTableClient,
        TechnicalLockedProfilesDataTableAdapter.schema,
      ),
    );

  return {
    authEventServiceBusAdapter,
    lollipopActivationCosmosAdapter,
    lollipopRevocationQueueAdapter,
    platformInternalAdapter,
    sessionCosmosAdapter,
    technicalLockedProfilesAdapter,
  };
};

/**
 * Creates application use cases.
 *
 * @param adapters - Outbound adapters.
 * @returns The application use cases.
 */
const createUseCases = (
  config: Config,
  adapters: Awaited<ReturnType<typeof createAdapters>>,
) => {
  const invalidatePreviousUserStateUseCase =
    makeInvalidatePreviousUserStateUseCase({
      sessionPort: adapters.sessionCosmosAdapter,
      lollipopActivationPort: adapters.lollipopActivationCosmosAdapter,
      lollipopRevocationPort: adapters.lollipopRevocationQueueAdapter,
      platformInternalPort: adapters.platformInternalAdapter,
    });

  const technicalLockUserSessionUseCase = makeTechnicalLockUserSessionUseCase({
    platformInternalPort: adapters.platformInternalAdapter,
    sessionPort: adapters.sessionCosmosAdapter,
    technicalLockedProfilesPort: adapters.technicalLockedProfilesAdapter,
    authEventPort: adapters.authEventServiceBusAdapter,
    invalidatePreviousUserStateUseCase,
  });
  const technicalUnlockUserSessionUseCase =
    makeTechnicalUnlockUserSessionUseCase(
      adapters.technicalLockedProfilesAdapter,
    );

  const getSessionUseCase = makeGetSessionUseCase(adapters.sessionCosmosAdapter);
  const getSessionStateUseCase = makeGetSessionStateUseCase({
    sessionPort: adapters.sessionCosmosAdapter,
    technicalLockedProfilesPort: adapters.technicalLockedProfilesAdapter,
  });

  return {
    technicalLockUserSessionUseCase,
    technicalUnlockUserSessionUseCase,
    getSessionUseCase,
    getSessionStateUseCase,
  };
};

const mountHealthChecks = (
  server: FastifyInstance,
  packageInfo: PackageInfo,
  adapters: Awaited<ReturnType<typeof createAdapters>>,
) => {
  mountHealthCheckHandler("liveness")(
    server,
    getHealthCheckUseCase(packageInfo),
  );
  mountHealthCheckHandler("readiness")(
    server,
    getHealthCheckUseCase(
      packageInfo,
      [
        adapters.technicalLockedProfilesAdapter,
        adapters.authEventServiceBusAdapter,
        adapters.sessionCosmosAdapter,
        adapters.lollipopActivationCosmosAdapter,
        adapters.lollipopRevocationQueueAdapter,
      ].map((port) => ({ name: port.constructor.name, port })),
    ),
  );
};

const mountRoutes = ({
  server,
  config,
  useCases,
}: {
  server: FastifyInstance;
  config: Config;
  useCases: ReturnType<typeof createUseCases>;
}) => {
  mountTechnicalLockUserSessionHandler(
    server,
    useCases.technicalLockUserSessionUseCase,
  );
  mountTechnicalUnlockUserSessionHandler(
    server,
    useCases.technicalUnlockUserSessionUseCase,
  );

  mountGetSessionHandler(server, useCases.getSessionUseCase);
  mountGetSessionStateHandler(server, useCases.getSessionStateUseCase);
};

export const createApp = async (
  config: Config,
  packageInfo: PackageInfo,
): Promise<{ server: FastifyInstance }> => {
  const server = fastify();
  const lifecycle = createResourceLifecycle(server);

  try {
    server.addHook("onClose", lifecycle.cleanupResources);

    const clients = createClients(config, lifecycle.registerCleanup);
    const adapters = await createAdapters(config, clients);
    const useCases = createUseCases(config, adapters);

    mountHealthChecks(server, packageInfo, adapters);
    mountRoutes({ server, config, useCases });

    return { server };
  } catch (error) {
    await lifecycle.cleanupResources();
    await lifecycle.closeServer();
    throw error;
  }
};
