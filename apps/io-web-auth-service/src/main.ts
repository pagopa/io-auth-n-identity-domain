import "dotenv/config";

import { fileURLToPath } from "node:url";

import type { NonEmptyString } from "@pagopa/hexagonal-core";
import type { Logger } from "@pagopa/hexagonal-core/domain/ports";
import { createPackageInfoAdapter } from "@pagopa/io-package-info";

import { createConfigLoader } from "./adapters/outbound/config-loader.js";
import { createApp } from "./app.js";
import { ConfigSchema } from "./domain/value-objects/configs/index.js";
import { getLogger } from "./telemetry-client.js";

const SHUTDOWN_TIMEOUT_MS = 10_000;
const logger = getLogger("gab-io-web-auth-service" as NonEmptyString);

const reportError = (logger: Logger, message: string, error: unknown): void => {
  logger.trackException({
    error: error instanceof Error ? error : new Error(String(error)),
    properties: { message },
  });
};

const bootstrap = () => {
  const configResult = createConfigLoader(ConfigSchema).load();
  if (configResult.isErr()) {
    throw new Error("Failed to load configuration", {
      cause: configResult.error,
    });
  }

  const packageInfoResult = createPackageInfoAdapter(
    fileURLToPath(new URL("../package.json", import.meta.url)),
  ).load();
  if (packageInfoResult.isErr()) {
    throw new Error("Failed to load package info", {
      cause: packageInfoResult.error,
    });
  }

  return { config: configResult.value, packageInfo: packageInfoResult.value };
};

const registerLifecycle = (
  server: Awaited<ReturnType<typeof createApp>>["server"],
  logger: Logger,
) => {
  let shutdownPromise: Promise<void> | undefined;

  const shutdown = (exitCode: number): Promise<void> => {
    if (exitCode !== 0 || process.exitCode === undefined) {
      process.exitCode = exitCode;
    }
    if (shutdownPromise) {
      return shutdownPromise;
    }

    const timeout = setTimeout(() => {
      logger.error("Application shutdown timed out");
      console.error("Application shutdown timed out");
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);

    shutdownPromise = (async () => {
      try {
        await server.close();
      } catch (error) {
        reportError(logger, "Failed to close application", error);
        process.exitCode = 1;
      } finally {
        try {
          await logger.flush();
        } catch (error) {
          console.error("Failed to flush telemetry:", error);
        } finally {
          clearTimeout(timeout);
          process.exit(process.exitCode ?? 0);
        }
      }
    })();
    return shutdownPromise;
  };

  const handleFatalError = (error: unknown): void => {
    reportError(logger, "Fatal application error", error);
    void shutdown(1);
  };

  process.on("SIGTERM", () => void shutdown(0));
  process.on("SIGINT", () => void shutdown(0));
  process.on("uncaughtException", handleFatalError);
  process.on("unhandledRejection", handleFatalError);

  return { handleFatalError };
};

const start = async () => {
  const { config, packageInfo } = bootstrap();
  const { server } = await createApp(config, packageInfo);
  const { handleFatalError } = registerLifecycle(server, logger);

  logger.info("Starting application", { ...packageInfo });
  try {
    await server.listen({ host: config.HOST, port: config.PORT });
    logger.info("Server listening", { host: config.HOST, port: config.PORT });
  } catch (error) {
    handleFatalError(error);
  }
};

// -------------------------
// Start the application
// -------------------------

await start().catch(async (error: unknown) => {
  reportError(logger, "Failed to start application", error);
  const timeout = setTimeout(() => process.exit(1), SHUTDOWN_TIMEOUT_MS);
  try {
    await logger.flush();
  } catch (flushError) {
    console.error("Failed to flush telemetry:", flushError);
  } finally {
    clearTimeout(timeout);
    process.exit(1);
  }
});
