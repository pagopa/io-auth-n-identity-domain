import { fileURLToPath } from "node:url";

import { logs } from "@opentelemetry/api-logs";
import type { NonEmptyString } from "@pagopa/hexagonal-core";
import { createPackageInfoAdapter } from "@pagopa/io-package-info";

import { createConfigLoader } from "./adapters/outbound/config-loader.js";
import { createApp } from "./app.js";
import { ConfigSchema } from "./domain/value-objects/configs/index.js";
import { getLogger } from "./telemetry-client.js";

const SHUTDOWN_TIMEOUT_MS = 10_000;

/**
 * Loads application configuration and package metadata.
 *
 * @returns The application bootstrap data.
 */
const bootstrap = () => {
  const logger = getLogger("io-session-manager-oi" as NonEmptyString);

  const configResult = createConfigLoader(ConfigSchema, {
    mappings: {
      TEST_LOGIN_FISCAL_CODES: "TEST_LOGIN_FISCAL_CODES_COMPRESSED",
    },
  }).load();
  if (configResult.isErr()) {
    throw new Error("Failed to load configuration", {
      cause: configResult.error,
    });
  }

  const config = configResult.value;

  const packageInfoResult = createPackageInfoAdapter(
    fileURLToPath(new URL("../package.json", import.meta.url)),
  ).load();
  if (packageInfoResult.isErr()) {
    throw new Error("Failed to load package info", {
      cause: packageInfoResult.error,
    });
  }

  return { config, packageInfo: packageInfoResult.value, logger };
};

/**
 * Registers process lifecycle handlers with a shared shutdown operation.
 *
 * @param server - Application server.
 * @returns The fatal-error handler.
 */
const registerLifecycle = (
  server: Awaited<ReturnType<typeof createApp>>["server"],
  logger: Logger,
) => {
  // Shares one shutdown operation across repeated signals and fatal errors.
  let shutdownPromise: Promise<void> | undefined;

  /**
   * Creates a shutdown function that closes the application and exits the process.
   *
   * @param logger - Logger instance for shutdown messages.
   * @returns The shutdown function.
   */
  const makeShutdown =
    (logger: Logger) =>
    /**
     * Closes the application and exits the process within the shutdown timeout.
     *
     * @param exitCode - Requested process exit status.
     * @returns The shared shutdown promise.
     */
    (exitCode: number): Promise<void> => {
      if (exitCode !== 0 || process.exitCode === undefined) {
        process.exitCode = exitCode;
      }
      if (shutdownPromise) {
        return shutdownPromise;
      }

      const timeout = setTimeout(() => {
        logger.error("Application shutdown timed out");
        process.exit(1);
      }, SHUTDOWN_TIMEOUT_MS);

      shutdownPromise = (async () => {
        try {
          await server.close();
        } catch (error) {
          const message =
            error instanceof Error
              ? error.stack ?? error.message
              : String(error);
          logger.error(`Failed to close application: ${message}`);
          process.exitCode = 1;
        } finally {
          clearTimeout(timeout);
          process.exit(process.exitCode ?? 0);
        }
      })();
      return shutdownPromise;
    };

  const shutdown = makeShutdown(logger);

  /**
   * Logs a fatal error and requests application shutdown.
   *
   * @param error - Fatal application error.
   * @returns Nothing.
   */
  const handleFatalError = (error: unknown): void => {
    logger.error(`Fatal application error: ${String(error)}`);
    void shutdown(1);
  };

  process.on("SIGTERM", () => void shutdown(0));
  process.on("SIGINT", () => void shutdown(0));
  process.on("uncaughtException", handleFatalError);
  process.on("unhandledRejection", handleFatalError);

  return { handleFatalError };
};

/**
 * Initializes the application and starts the server.
 *
 * @returns A promise for application startup.
 */
const start = async () => {
  const { config, packageInfo, logger } = bootstrap();
  const { server } = await createApp(config, packageInfo);
  const { handleFatalError } = registerLifecycle(server);
  const logger = getLogger(
    packageInfo.name as NonEmptyString,
    packageInfo.version,
  );

  try {
    await server.listen({ host: config.HOST, port: config.PORT });
    logger.info("Server started", {
      host: config.HOST,
      port: config.PORT,
    });
  } catch (error) {
    handleFatalError(error);
  }
};

await start().catch((error: unknown) => {
  console.error("Failed to start application:", error);
  process.exit(1);
});
