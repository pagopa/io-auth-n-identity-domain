import { CosmosClient } from "@azure/cosmos";
import { TableClient } from "@azure/data-tables";
import { DefaultAzureCredential } from "@azure/identity";
import { ServiceBusClient } from "@azure/service-bus";
import { QueueServiceClient } from "@azure/storage-queue";
import formbody from "@fastify/formbody";
import { TableClientWrapper } from "@pagopa/azure-sdk/data-tables";
import { FiscalCodeSchema } from "@pagopa/hexagonal-core";
import {
  LollipopActivationCosmosAdapter,
  SessionCosmosAdapter,
} from "@pagopa/io-auth-n-identity-session/adapters";
import { type PackageInfo } from "@pagopa/io-package-info";
import {
  createRedisClusterClient,
  createRedisManagedIdentityClusterClient,
} from "@pagopa/redis/node-client";
import { RedisObjectWrapper } from "@pagopa/redis/object-wrapper";
import { RedisSetWrapper } from "@pagopa/redis/set-wrapper";
import fastify, { type FastifyInstance } from "fastify";

import { mountCallbackHandler } from "./adapters/inbound/fastify/callback.handler.js";
import { mountFastLoginHandler } from "./adapters/inbound/fastify/fast-login.handler.js";
import { mountGenerateNonceHandler } from "./adapters/inbound/fastify/generate-nonce.handler.js";
import { mountGetSessionHandler } from "./adapters/inbound/fastify/get-session.handler.js";
import { mountHealthCheckHandler } from "./adapters/inbound/fastify/health-check.handler.js";
import { normalizeClientIpHook } from "./adapters/inbound/fastify/hooks/client-ip.hook.js";
import { extractIpMiddleware } from "./adapters/inbound/fastify/middlewares/extract-ip.middleware.js";
import { mountReserveHandler } from "./adapters/inbound/fastify/reserve.handler.js";
import { mountSsoBpdUserHandler } from "./adapters/inbound/fastify/sso-bpd-user.handler.js";
import { mountSsoFimsLollipopUserHandler } from "./adapters/inbound/fastify/sso-fims-lollipop-user.handler.js";
import { mountSsoFimsUserHandler } from "./adapters/inbound/fastify/sso-fims-user.handler.js";
import { mountSsoPagopaUserHandler } from "./adapters/inbound/fastify/sso-pagopa-user.handler.js";
import { mountSsoZendeskTokenHandler } from "./adapters/inbound/fastify/sso-zendesk-token.handler.js";
import { AuthEventServiceBusAdapter } from "./adapters/outbound/auth-event-service-bus.adapter.js";
import { AuxiliaryDataRedisAdapter } from "./adapters/outbound/auxiliary-data.adapter.js";
import { BlockedUsersRedisAdapter } from "./adapters/outbound/blocked-users-redis.adapter.js";
import { InMemoryOidcConfigAdapter } from "./adapters/outbound/in-memory-oidc-config.adapter.js";
import { createIoFastLoginAdapter } from "./adapters/outbound/io-fast-login.adapter.js";
import { createIoLollipopAdapter } from "./adapters/outbound/io-lollipop.adapter.js";
import { createIoProfileAdapter } from "./adapters/outbound/io-profile.adapter.js";
import { LockedProfilesDataTableAdapter } from "./adapters/outbound/locked-profiles-data-table.adapter.js";
import { LollipopRevocationQueueAdapter } from "./adapters/outbound/lollipop-revocation-queue.adapter.js";
import { NotificationStorageQueueAdapter } from "./adapters/outbound/notification-storage-queue.adapter.js";
import { OneIdIdentityAssertionFetcherAdapter } from "./adapters/outbound/one-id-identity-assertion-fetcher-adapter.js";
import { OpenIdClientAdapter } from "./adapters/outbound/openid-client.adapter.js";
import { createPlatformInternalAdapter } from "./adapters/outbound/platform-internal.adapter.js";
import { TechnicalLockedProfilesDataTableAdapter } from "./adapters/outbound/technical-locked-profiles-data-table.adapter.js";
import { makeActivateUserSessionUseCase } from "./application/use-cases/activate-user-session.use-case.js";
import { makeFastLoginUseCase } from "./application/use-cases/fast-login.use-case.js";
import { makeGenerateFastLoginLollipopParamsUseCase } from "./application/use-cases/generate-fast-login-lollipop-params.use-case.js";
import { makeGenerateNonceUseCase } from "./application/use-cases/generate-nonce.use-case.js";
import { makeGetLollipopUserForFimsUseCase } from "./application/use-cases/get-lollipop-user-for-fims.use-case.js";
import { makeGetSessionUseCase } from "./application/use-cases/get-session.use-case.js";
import { makeGetTokenForZendeskUseCase } from "./application/use-cases/get-token-for-zendesk.use-case.js";
import { getUserForBpdUseCase } from "./application/use-cases/get-user-for-bpd.use-case.js";
import { makeGetUserForFimsUseCase } from "./application/use-cases/get-user-for-fims.use-case.js";
import { makeGetUserForPagopaUseCase } from "./application/use-cases/get-user-for-pagopa.use-case.js";
import { makeHandleOidcCallbackUseCase } from "./application/use-cases/handle-oidc-callback.use-case.js";
import { getHealthCheckUseCase } from "./application/use-cases/health-check.use-case.js";
import { makeInvalidateSessionTokenCacheUseCase } from "./application/use-cases/invalidate-session-token-cache.use-case.js";
import { makeRefreshUserSessionUseCase } from "./application/use-cases/refresh-user-session.use-case.js";
import { makeReserveUseCase } from "./application/use-cases/reserve.use-case.js";
import { makeValidateProfileLocksUseCase } from "./application/use-cases/validate-profile-locks.use-case.js";
import { type Config } from "./domain/value-objects/configs/index.js";
import { LoginAuxiliaryDataSchema } from "./domain/value-objects/login.vo.js";
import {
  AuthenticationMiddlewareFactory,
  TokenIntrospectionStrategyFactory,
  TokenParsingStrategyFactory,
  TokenTransportStrategyFactory,
} from "./middlewares/authentication/index.js";

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

const CLEANUP_TIMEOUT_MS = 2_000;

/**
 * Tracks app-owned resources for startup rollback and Fastify shutdown.
 * Cleanup runs once in reverse registration order, logging failures and timeouts.
 *
 * @param server - Application server.
 * @returns Resource lifecycle operations.
 */
const createResourceLifecycle = (server: FastifyInstance) => {
  const cleanups: { name: string; close: () => unknown }[] = [];
  let cleanupPromise: Promise<void> | undefined;

  /**
   * Attempts cleanup within the per-resource timeout without propagating errors.
   * Timing out stops waiting but does not cancel the underlying operation.
   *
   * @param name - Resource name.
   * @param close - Resource cleanup callback.
   * @returns A promise for the cleanup attempt.
   */
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

  /**
   * Shares one cleanup promise across rollback and repeated shutdown calls.
   *
   * @returns The shared cleanup promise.
   */
  const cleanupResources = (): Promise<void> => {
    cleanupPromise ??= Promise.resolve().then(async () => {
      for (const resource of [...cleanups].reverse()) {
        await closeResource(resource.name, resource.close);
      }
    });
    return cleanupPromise;
  };

  return {
    /**
     * Registers a resource cleanup callback.
     *
     * @param name - Resource name.
     * @param close - Resource cleanup callback.
     * @returns Nothing.
     */
    registerCleanup: (name: string, close: () => unknown) => {
      cleanups.push({ name, close });
    },
    cleanupResources,
    /**
     * Attempts to close the application server within the cleanup timeout.
     *
     * @returns A promise for the server cleanup attempt.
     */
    closeServer: () => closeResource("Fastify server", () => server.close()),
  };
};

/**
 * Creates infrastructure clients for the application.
 *
 * @param config - Application configuration.
 * @param registerCleanup - Resource cleanup registration callback.
 * @returns The initialized infrastructure clients.
 */
// eslint-disable-next-line max-lines-per-function
const createClients = async (
  config: Config,
  registerCleanup: ReturnType<
    typeof createResourceLifecycle
  >["registerCleanup"],
) => {
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
          { allowInsecureConnection: config.NODE_ENV === "development" },
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

  const pushNotificationsQueueServiceClient =
    config.NODE_ENV === "production"
      ? new QueueServiceClient(
          config.PUSH_NOTIFICATIONS_QUEUE_STORAGE_URI,
          AzureCredential.getInstance(),
        )
      : QueueServiceClient.fromConnectionString(
          config.PUSH_NOTIFICATIONS_STORAGE_CONNECTION_STRING,
        );

  const lollipopRevocationQueueServiceClient =
    config.NODE_ENV === "production"
      ? new QueueServiceClient(
          config.LOLLIPOP_REVOCATION_QUEUE_STORAGE_URI,
          AzureCredential.getInstance(),
        )
      : QueueServiceClient.fromConnectionString(
          config.LOLLIPOP_REVOCATION_QUEUE_STORAGE_CONNECTION_STRING,
        );

  const redisClient =
    config.NODE_ENV === "production"
      ? await createRedisManagedIdentityClusterClient(
          {
            hostname: config.REDIS_HOSTNAME,
            port: config.REDIS_PORT,
            enableTls: config.REDIS_TLS_ENABLED,
          },
          AzureCredential.getInstance(),
        )
      : await createRedisClusterClient({
          hostname: config.REDIS_HOSTNAME,
          password: config.REDIS_PASSWORD,
          port: config.REDIS_PORT,
          enableTls: config.REDIS_TLS_ENABLED,
        });
  registerCleanup("Redis client", () => redisClient.close());

  const cosmosClient =
    config.NODE_ENV === "production"
      ? new CosmosClient({
          endpoint: config.COSMOSDB_URI,
          aadCredentials: AzureCredential.getInstance(),
        })
      : new CosmosClient(config.COSMOSDB_CONNECTION_STRING);
  registerCleanup("Cosmos client", () => cosmosClient.dispose());

  const serviceBusClient =
    config.NODE_ENV === "production"
      ? new ServiceBusClient(
          config.SERVICE_BUS_HOSTNAME,
          AzureCredential.getInstance(),
        )
      : new ServiceBusClient(config.SERVICE_BUS_CONNECTION_STRING);
  registerCleanup("Service Bus client", () => serviceBusClient.close());

  return {
    lockedProfilesTableClient,
    technicalLockedProfilesTableClient,
    pushNotificationsQueueServiceClient,
    lollipopRevocationQueueServiceClient,
    redisClient,
    cosmosClient,
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
// eslint-disable-next-line max-lines-per-function
const createAdapters = async (
  config: Config,
  clients: Awaited<ReturnType<typeof createClients>>,
) => {
  const lockedProfilesAdapter = new LockedProfilesDataTableAdapter(
    new TableClientWrapper(
      clients.lockedProfilesTableClient,
      LockedProfilesDataTableAdapter.schema,
    ),
  );

  const technicalLockedProfilesAdapter =
    new TechnicalLockedProfilesDataTableAdapter(
      new TableClientWrapper(
        clients.technicalLockedProfilesTableClient,
        TechnicalLockedProfilesDataTableAdapter.schema,
      ),
    );

  const notificationStorageQueueAdapter = new NotificationStorageQueueAdapter(
    clients.pushNotificationsQueueServiceClient.getQueueClient(
      config.PUSH_NOTIFICATIONS_QUEUE_NAME,
    ),
  );

  const lollipopRevocationQueueAdapter = new LollipopRevocationQueueAdapter(
    clients.lollipopRevocationQueueServiceClient.getQueueClient(
      config.LOLLIPOP_REVOCATION_QUEUE_NAME,
    ),
  );

  const blockedUsersAdapter = new BlockedUsersRedisAdapter(
    // Both generics are inferred from the constructor arguments:
    // `TSchema` from `FiscalCodeSchema` and `TClient` from `redisClient`.
    new RedisSetWrapper(clients.redisClient, FiscalCodeSchema),
  );

  const sessionCosmosAdapter = new SessionCosmosAdapter(
    clients.cosmosClient,
    config.COSMOSDB_NAME,
    config.COSMOSDB_SESSION_TOKEN_CONTAINER_NAME,
    config.COSMOSDB_ACTIVE_SESSION_CONTAINER_NAME,
  );

  const auxiliaryStorageAdapter = new AuxiliaryDataRedisAdapter(
    new RedisObjectWrapper(clients.redisClient, LoginAuxiliaryDataSchema),
    config.LOGIN_AUXILIARY_DATA_TTL_SECONDS,
  );

  const fetchLollipopAdapter = createIoLollipopAdapter({
    baseUrl: new URL(config.LOLLIPOP_API_BASE_PATH, config.LOLLIPOP_API_URL),
    apiKey: config.LOLLIPOP_API_KEY,
  });

  const fastLoginAdapter = createIoFastLoginAdapter({
    baseUrl: new URL(
      config.IO_FAST_LOGIN_API_BASE_PATH,
      config.IO_FAST_LOGIN_API_URL,
    ),
    apiKey: config.IO_FAST_LOGIN_API_KEY,
  });

  const profileAdapter = createIoProfileAdapter({
    baseUrl: new URL(
      config.IO_PROFILE_API_BASE_PATH,
      config.IO_PROFILE_API_URL,
    ),
    apiKey: config.IO_PROFILE_API_KEY,
  });

  const platformInternalAdapter = createPlatformInternalAdapter({
    baseUrl: new URL(
      config.PLATFORM_PROXY_API_BASE_PATH,
      config.PLATFORM_PROXY_API_URL,
    ),
  });

  const oidcConfigAdapter = new InMemoryOidcConfigAdapter(config);

  const oidcExchangeAdapter = new OpenIdClientAdapter(
    oidcConfigAdapter,
    config.ONEID_HTTP_TIMEOUT_SECONDS,
  );
  // Warm up OIDC discovery (metadata + JWKS) so the cost is paid at startup
  // Best-effort: never blocks boot on a provider outage — the lazy path retries on demand.
  await oidcExchangeAdapter.warmUp(new Set(["PROD", "UAT"])).catch((error) => {
    console.warn("Failed to warm up OIDC exchange adapter:", error);
  });

  const authEventServiceBusAdapter = new AuthEventServiceBusAdapter(
    clients.serviceBusClient.createSender(config.AUTH_SESSIONS_TOPIC_NAME),
  );

  const lollipopActivationCosmosAdapter = new LollipopActivationCosmosAdapter(
    clients.cosmosClient,
    config.COSMOSDB_NAME,
    config.COSMOSDB_LOLLIPOP_ACTIVATION_CONTAINER_NAME,
  );

  const oneIdIdentityAssertionFetcherAdapter =
    new OneIdIdentityAssertionFetcherAdapter(config);

  return {
    lockedProfilesAdapter,
    technicalLockedProfilesAdapter,
    notificationStorageQueueAdapter,
    lollipopRevocationQueueAdapter,
    blockedUsersAdapter,
    sessionCosmosAdapter,
    auxiliaryStorageAdapter,
    fetchLollipopAdapter,
    fastLoginAdapter,
    profileAdapter,
    platformInternalAdapter,
    oidcConfigAdapter,
    oidcExchangeAdapter,
    authEventServiceBusAdapter,
    lollipopActivationCosmosAdapter,
    oneIdIdentityAssertionFetcherAdapter,
  };
};

/**
 * Creates application use cases.
 *
 * @param adapters - Outbound adapters.
 * @returns The application use cases.
 */
const createUseCases = (
  adapters: Awaited<ReturnType<typeof createAdapters>>,
  config: Config,
) => {
  const reserveUseCase = makeReserveUseCase({
    auxiliaryDataPort: adapters.auxiliaryStorageAdapter,
    lollipopPort: adapters.fetchLollipopAdapter,
    oidcClientPort: adapters.oidcExchangeAdapter,
    oidcConfigPort: adapters.oidcConfigAdapter,
  });

  const invalidateSessionTokenCacheUseCase =
    makeInvalidateSessionTokenCacheUseCase({
      platformInternalPort: adapters.platformInternalAdapter,
    });

  const activateUserSessionUseCase = makeActivateUserSessionUseCase({
    sessionPort: adapters.sessionCosmosAdapter,
    profilePort: adapters.profileAdapter,
    authEventPort: adapters.authEventServiceBusAdapter,
    lollipopActivationPort: adapters.lollipopActivationCosmosAdapter,
    lollipopPort: adapters.fetchLollipopAdapter,
    lollipopRevocationPort: adapters.lollipopRevocationQueueAdapter,
    invalidateSessionTokenCacheUseCase: invalidateSessionTokenCacheUseCase,
    notificationPort: adapters.notificationStorageQueueAdapter,
  });

  const validateProfileLocksUseCase = makeValidateProfileLocksUseCase({
    lockedProfilesPort: adapters.lockedProfilesAdapter,
    technicalLockedProfilesPort: adapters.technicalLockedProfilesAdapter,
  });

  const handleOidcCallbackUseCase = makeHandleOidcCallbackUseCase({
    auxiliaryDataPort: adapters.auxiliaryStorageAdapter,
    oidcPort: adapters.oidcExchangeAdapter,
    identityAssertionFetcherPort: adapters.oneIdIdentityAssertionFetcherAdapter,
    validateProfileLocksUseCase,
    activateUserSessionUseCase,
  });

  const fastLoginUseCase = makeFastLoginUseCase({
    fastLoginPort: adapters.fastLoginAdapter,
    validateProfileLocksUseCase,
    generateFastLoginLollipopParamsUseCase:
      makeGenerateFastLoginLollipopParamsUseCase({
        lollipopPort: adapters.fetchLollipopAdapter,
        lollipopActivationPort: adapters.lollipopActivationCosmosAdapter,
      }),
    refreshUserSessionUseCase: makeRefreshUserSessionUseCase({
      sessionPort: adapters.sessionCosmosAdapter,
      invalidateSessionTokenCacheUseCase: invalidateSessionTokenCacheUseCase,
    }),
    enabled: config.FF_FAST_LOGIN,
  });

  const getSessionUseCase = makeGetSessionUseCase({
    sessionPort: adapters.sessionCosmosAdapter,
    lollipopActivationPort: adapters.lollipopActivationCosmosAdapter,
    profilePort: adapters.profileAdapter,
  });

  const getUserForFimsUseCase = makeGetUserForFimsUseCase({
    profilePort: adapters.profileAdapter,
  });

  return {
    reserveUseCase,
    fastLoginUseCase,
    handleOidcCallbackUseCase,
    getSessionUseCase,
    getUserForFimsUseCase,
  };
};

/**
 * Creates application authentication middleware.
 *
 * @param sessionCosmosAdapter - Session storage adapter.
 * @returns The authentication middleware.
 */
const createAuthenticationMiddlewares = (
  sessionCosmosAdapter: Awaited<
    ReturnType<typeof createAdapters>
  >["sessionCosmosAdapter"],
) => {
  const authenticationMiddlewareFactory = new AuthenticationMiddlewareFactory(
    new TokenTransportStrategyFactory(),
    new TokenParsingStrategyFactory(),
    new TokenIntrospectionStrategyFactory(sessionCosmosAdapter),
  );
  const authenticateSessionMiddleware =
    authenticationMiddlewareFactory.create("session");
  const authenticateBpdMiddleware =
    authenticationMiddlewareFactory.create("bpd");
  const authenticateFimsMiddleware =
    authenticationMiddlewareFactory.create("fims");
  const authenticatePagopaMiddleware =
    authenticationMiddlewareFactory.create("pagopa");
  const authenticateZendeskMiddleware =
    authenticationMiddlewareFactory.create("zendesk");

  return {
    authenticateSessionMiddleware,
    authenticateBpdMiddleware,
    authenticateFimsMiddleware,
    authenticatePagopaMiddleware,
    authenticateZendeskMiddleware,
  };
};

/**
 * Registers application health-check routes.
 *
 * @param server - Application server.
 * @param packageInfo - Package metadata.
 * @param adapters - Outbound adapters.
 * @returns Nothing.
 */
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
    getHealthCheckUseCase(packageInfo, [
      {
        name: adapters.lockedProfilesAdapter.constructor.name,
        port: adapters.lockedProfilesAdapter,
      },
      {
        name: adapters.technicalLockedProfilesAdapter.constructor.name,
        port: adapters.technicalLockedProfilesAdapter,
      },
      {
        name: adapters.notificationStorageQueueAdapter.constructor.name,
        port: adapters.notificationStorageQueueAdapter,
      },
      {
        name: adapters.blockedUsersAdapter.constructor.name,
        port: adapters.blockedUsersAdapter,
      },
      {
        name: adapters.auxiliaryStorageAdapter.constructor.name,
        port: adapters.auxiliaryStorageAdapter,
      },
      {
        name: adapters.authEventServiceBusAdapter.constructor.name,
        port: adapters.authEventServiceBusAdapter,
      },
      {
        name: adapters.sessionCosmosAdapter.constructor.name,
        port: adapters.sessionCosmosAdapter,
      },
      {
        name: adapters.lollipopActivationCosmosAdapter.constructor.name,
        port: adapters.lollipopActivationCosmosAdapter,
      },
      {
        name: adapters.oneIdIdentityAssertionFetcherAdapter.constructor.name,
        port: adapters.oneIdIdentityAssertionFetcherAdapter,
      },
      {
        name: adapters.lollipopRevocationQueueAdapter.constructor.name,
        port: adapters.lollipopRevocationQueueAdapter,
      },
    ]),
  );
};

/**
 * Registers application routes.
 *
 * @param options - Route dependencies.
 * @returns Nothing.
 */
// eslint-disable-next-line max-lines-per-function
const mountRoutes = ({
  server,
  config,
  adapters,
  useCases,
  middlewares,
}: {
  server: FastifyInstance;
  config: Config;
  adapters: Awaited<ReturnType<typeof createAdapters>>;
  useCases: ReturnType<typeof createUseCases>;
  middlewares: ReturnType<typeof createAuthenticationMiddlewares>;
}) => {
  mountReserveHandler(server, useCases.reserveUseCase);

  mountGenerateNonceHandler(
    server,
    makeGenerateNonceUseCase(adapters.fastLoginAdapter),
  );

  mountFastLoginHandler(server, {
    middlewares: {
      extractIpMiddleware,
    },
    useCase: useCases.fastLoginUseCase,
  });

  mountCallbackHandler(server, {
    handleOidcCallbackUseCase: useCases.handleOidcCallbackUseCase,
    loginSuccessRedirectUrl: config.LOGIN_SUCCESS_REDIRECT_URL,
    loginErrorRedirectUrl: config.LOGIN_ERROR_REDIRECT_URL,
  });

  mountSsoBpdUserHandler(server, {
    allowedIpSourceRange: config.ALLOW_BPD_IP_SOURCE_RANGE,
    middlewares: [middlewares.authenticateBpdMiddleware] as const,
    useCase: getUserForBpdUseCase,
  });

  mountSsoFimsUserHandler(server, {
    allowedIpSourceRange: config.ALLOW_FIMS_IP_SOURCE_RANGE,
    middlewares: [middlewares.authenticateFimsMiddleware] as const,
    useCase: useCases.getUserForFimsUseCase,
  });

  mountSsoFimsLollipopUserHandler(server, {
    allowedIpSourceRange: config.ALLOW_FIMS_IP_SOURCE_RANGE,
    middlewares: [middlewares.authenticateFimsMiddleware] as const,
    useCase: makeGetLollipopUserForFimsUseCase({
      profilePort: adapters.profileAdapter,
      lollipopPort: adapters.fetchLollipopAdapter,
      lollipopActivationPort: adapters.lollipopActivationCosmosAdapter,
      getUserForFimsUseCase: useCases.getUserForFimsUseCase,
    }),
  });

  mountSsoPagopaUserHandler(server, {
    allowedIpSourceRange: config.ALLOW_PAGOPA_IP_SOURCE_RANGE,
    middlewares: [middlewares.authenticatePagopaMiddleware] as const,
    useCase: makeGetUserForPagopaUseCase({
      profilePort: adapters.profileAdapter,
    }),
  });

  mountSsoZendeskTokenHandler(server, {
    allowedIpSourceRange: config.ALLOW_ZENDESK_IP_SOURCE_RANGE,
    middlewares: [middlewares.authenticateZendeskMiddleware] as const,
    useCase: makeGetTokenForZendeskUseCase({
      profilePort: adapters.profileAdapter,
      config,
    }),
  });

  mountGetSessionHandler({
    middlewares: [middlewares.authenticateSessionMiddleware] as const,
    useCase: useCases.getSessionUseCase,
  })(server);
};

/**
 * Creates the application and configures resource cleanup without starting the listener.
 *
 * @param config - Application configuration.
 * @param packageInfo - Package metadata.
 * @returns The configured application server.
 */
export const createApp = async (
  config: Config,
  packageInfo: PackageInfo,
): Promise<{ server: FastifyInstance }> => {
  const server = fastify({
    trustProxy: true, // Enable trust proxy to get correct client IPs behind proxies (necessary for check-ip hook)
  });
  const lifecycle = createResourceLifecycle(server);

  try {
    server.addHook("onClose", lifecycle.cleanupResources);
    server.register(formbody);

    const clients = await createClients(config, lifecycle.registerCleanup);
    const adapters = await createAdapters(config, clients);
    const useCases = createUseCases(adapters, config);
    const middlewares = createAuthenticationMiddlewares(
      adapters.sessionCosmosAdapter,
    );

    mountHealthChecks(server, packageInfo, adapters);
    mountRoutes({ server, config, adapters, useCases, middlewares });
    server.addHook("onRequest", normalizeClientIpHook);

    return { server };
  } catch (error) {
    await lifecycle.cleanupResources();
    await lifecycle.closeServer();
    throw error;
  }
};
