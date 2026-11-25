import { DefaultAzureCredential } from "@azure/identity";
import { createPrivateKey } from "node:crypto";

import type { NonEmptyString } from "@pagopa/hexagonal-core";
import type { Logger } from "@pagopa/hexagonal-core/domain/ports";
import { type PackageInfo } from "@pagopa/io-package-info";
import {
  createRedisClusterClient,
  createRedisManagedIdentityClusterClient,
} from "@pagopa/redis/node-client";
import { RedisObjectWrapper } from "@pagopa/redis/object-wrapper";
import fastify, { type FastifyInstance } from "fastify";

import { mountHealthCheckHandler } from "./adapters/inbound/fastify/health-check.handler.js";
import { normalizeClientIpHook } from "./adapters/inbound/fastify/hooks/client-ip.hook.js";
import { mountLoginHandler } from "./adapters/inbound/fastify/login.handler.js";
import { extractIpMiddleware } from "./adapters/inbound/fastify/middlewares/extract-ip.middleware.js";
import { AuxiliaryDataRedisAdapter } from "./adapters/outbound/auxiliary-data.adapter.js";
import { InMemoryOidcConfigAdapter } from "./adapters/outbound/in-memory-oidc-config.adapter.js";
import { OpenIdClientAdapter } from "./adapters/outbound/openid-client.adapter.js";
import { getHealthCheckUseCase } from "./application/use-cases/health-check.use-case.js";
import { makeStartLoginUseCase } from "./application/use-cases/start-login.use-case.js";
import { type Config } from "./domain/value-objects/configs/index.js";
import { LoginAuxiliaryDataSchema } from "./domain/value-objects/login.vo.js";
import { withErrorResultLogging } from "./middlewares/result-logging.middleware.js";
import { getLogger } from "./telemetry-client.js";
import { JwtSessionAdapter } from "./adapters/outbound/jwt-session.js";
import { RedisSessionBlacklistAdapter } from "./adapters/outbound/redis-session-blacklist.adapter.js";
import { mountCallbackHandler } from "./adapters/inbound/fastify/callback.handler.js";
import { makeActivateUserSessionUseCase } from "./application/use-cases/activate-user-session.use-case.js";
import { mountIntrospectHandler } from "./adapters/inbound/fastify/introspect.handler.js";
import { makeIntrospectionUseCase } from "./application/use-cases/introspection.use-case.js";
import { makeHandleOidcCallbackUseCase } from "./application/use-cases/oidc-callback.use-case.js";

const CLEANUP_TIMEOUT_MS = 2_000;

/**
 * Tracks app-owned resources for startup rollback and Fastify shutdown.
 * Cleanup runs once in reverse registration order, logging failures and timeouts.
 *
 * @param server - Application server.
 * @param logger - Application logger for cleanup failures.
 * @returns Resource lifecycle operations.
 */
const createResourceLifecycle = (server: FastifyInstance, logger: Logger) => {
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
      logger.error(`Failed to clean up ${name}`, {
        error: error instanceof Error ? error.message : String(error),
      });
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
 * Creates infrastructure clients for the configured environment and registers
 * their cleanup as soon as they are initialized.
 *
 * @param config - Application configuration.
 * @param registerCleanup - Resource cleanup registration callback.
 * @param logger - Application logger for infrastructure client errors.
 * @returns The initialized infrastructure clients.
 */
const createClients = async (
  config: Config,
  registerCleanup: ReturnType<
    typeof createResourceLifecycle
  >["registerCleanup"],
  logger: Logger,
) => {
  const onRedisError = (error: Error): void =>
    logger.error("Redis client error", { error: error.message });

  if (config.NODE_ENV === "production") {
    // Production: use Azure-managed services with a shared Azure credential.
    const azureCredential = new DefaultAzureCredential();
    const redisClient = await createRedisManagedIdentityClusterClient(
      {
        hostname: config.REDIS_HOSTNAME,
        port: config.REDIS_PORT,
        enableTls: config.REDIS_TLS_ENABLED,
      },
      azureCredential,
      onRedisError,
    );
    registerCleanup("Redis client", () => redisClient.close());
    return { redisClient };
  } else {
    // Development: use local services without depending on Azure credentials.
    const redisClient = await createRedisClusterClient(
      {
        hostname: config.REDIS_HOSTNAME,
        password: config.REDIS_PASSWORD,
        port: config.REDIS_PORT,
        enableTls: config.REDIS_TLS_ENABLED,
      },
      onRedisError,
    );
    registerCleanup("Redis client", () => redisClient.close());
    return { redisClient };
  }
};

const createAdapters = async (
  config: Config,
  clients: Awaited<ReturnType<typeof createClients>>,
  logger: Logger,
) => {
  const auxiliaryDataAdapter = new AuxiliaryDataRedisAdapter(
    new RedisObjectWrapper(clients.redisClient, LoginAuxiliaryDataSchema),
    config.LOGIN_AUXILIARY_DATA_TTL_SECONDS,
  );
  const oidcConfigAdapter = new InMemoryOidcConfigAdapter(config);
  const oidcClientAdapter = new OpenIdClientAdapter(
    oidcConfigAdapter,
    config.ONEID_HTTP_TIMEOUT_SECONDS,
  );

  // Warm up OIDC discovery (metadata + JWKS) so the cost is paid at startup
  // Best-effort: never blocks boot on a provider outage — the lazy path retries on demand.
  await oidcClientAdapter.warmUp(new Set(["PROD", "UAT"])).catch((error) => {
    logger.warn("Failed to warm up OIDC client adapter", {
      error: String(error),
    });
  });

  const sessionAdapter = new JwtSessionAdapter(
    createPrivateKey(config.JWT_TOKEN_PRIVATE_KEY.replace(/\\n/g, "\n")),
    config.JWT_TOKEN_ISSUER,
    config.JWT_TOKEN_TTL_SECONDS,
  );

  const sessionBlacklistAdapter = new RedisSessionBlacklistAdapter(
    clients.redisClient,
  );

  return {
    auxiliaryDataAdapter,
    oidcConfigAdapter,
    oidcClientAdapter,
    sessionAdapter,
    sessionBlacklistAdapter,
  };
};

const mountRoutes = (
  server: FastifyInstance,
  packageInfo: PackageInfo,
  adapters: Awaited<ReturnType<typeof createAdapters>>,
  config: Config,
  logger: Logger,
) => {
  mountHealthCheckHandler("liveness")(
    server,
    withErrorResultLogging(logger.with({ component: "liveness" }))(
      getHealthCheckUseCase(packageInfo),
    ),
  );

  mountHealthCheckHandler("readiness")(
    server,
    withErrorResultLogging(logger.with({ component: "readiness" }))(
      getHealthCheckUseCase(packageInfo, [
        {
          name: adapters.auxiliaryDataAdapter.constructor.name,
          port: adapters.auxiliaryDataAdapter,
        },
      ]),
    ),
  );

  const startLoginLogger = logger.with({ component: "startLogin" });
  mountLoginHandler(server, {
    middlewares: [extractIpMiddleware] as const,
    useCase: withErrorResultLogging(startLoginLogger)(
      makeStartLoginUseCase({
        auxiliaryDataPort: adapters.auxiliaryDataAdapter,
        oidcClientPort: adapters.oidcClientAdapter,
        oidcConfigPort: adapters.oidcConfigAdapter,
        logger: startLoginLogger,
      }),
    ),
  });

  const callbackLogger = logger.with({ component: "callback" });
  mountCallbackHandler(server, {
    middlewares: [extractIpMiddleware] as const,
    handleOidcCallbackUseCase: withErrorResultLogging(callbackLogger)(
      makeHandleOidcCallbackUseCase({
        auxiliaryDataPort: adapters.auxiliaryDataAdapter,
        oidcClientPort: adapters.oidcClientAdapter,
        activateUserSessionUseCase: makeActivateUserSessionUseCase({
          sessionPort: adapters.sessionAdapter,
        }),
        logger: callbackLogger,
      }),
    ),
    loginSuccessRedirectUrl: config.LOGIN_SUCCESS_REDIRECT_URL,
    loginErrorRedirectUrl: config.LOGIN_ERROR_REDIRECT_URL,
  });

  mountIntrospectHandler(server, {
    introspectionUseCase: withErrorResultLogging(
      logger.with({ component: "introspect" }),
    )(
      makeIntrospectionUseCase({
        sessionBlacklistPort: adapters.sessionBlacklistAdapter,
        sessionPort: adapters.sessionAdapter,
      }),
    ),
  });
};

/**
 * Creates the application and configures resource cleanup without starting the listener.
 */
export const createApp = async (
  config: Config,
  packageInfo: PackageInfo,
): Promise<{ server: FastifyInstance }> => {
  // Trust proxy to resolve the real client IP behind the Application Gateway.
  const server = fastify({ trustProxy: true });
  const logger = getLogger(packageInfo.name as NonEmptyString);
  const lifecycle = createResourceLifecycle(server, logger);

  try {
    server.addHook("onClose", lifecycle.cleanupResources);

    const clients = await createClients(
      config,
      lifecycle.registerCleanup,
      logger,
    );
    const adapters = await createAdapters(config, clients, logger);

    mountRoutes(server, packageInfo, adapters, config, logger);
    server.addHook("onRequest", normalizeClientIpHook);

    return { server };
  } catch (error) {
    await lifecycle.cleanupResources();
    await lifecycle.closeServer();
    throw error;
  }
};
