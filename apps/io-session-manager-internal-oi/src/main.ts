import "dotenv/config";

import { fileURLToPath } from "node:url";

import { NonEmptyStringSchema } from "@pagopa/hexagonal-core";
import type { Logger } from "@pagopa/hexagonal-core/domain/ports";
import { createPackageInfoAdapter } from "@pagopa/io-package-info";

import { createConfigLoader } from "./adapters/outbound/config-loader.js";
import { createApp } from "./app.js";
import { ConfigSchema } from "./domain/value-objects/configs/index.js";
import { getLogger } from "./telemetry-client.js";

const SHUTDOWN_TIMEOUT_MS = 10_000;

const bootstrap = () => {
  const logger = getLogger(
    NonEmptyStringSchema.parse("io-session-manager-internal-oi"),
  );
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

  return {
    config: configResult.value,
    packageInfo: packageInfoResult.value,
    logger,
  };
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
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);

    shutdownPromise = (async () => {
      try {
        await server.close();
      } catch (error) {
        const message =
          error instanceof Error ? error.stack ?? error.message : String(error);
        logger.error(`Failed to close application: ${message}`);
        process.exitCode = 1;
      } finally {
        clearTimeout(timeout);
        process.exit(process.exitCode ?? 0);
      }
    })();
    return shutdownPromise;
  };

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

const start = async () => {
  const { config, packageInfo, logger } = bootstrap();
  const { server } = await createApp(config, packageInfo);
  const { handleFatalError } = registerLifecycle(server, logger);

  try {
    await server.listen({ host: config.HOST, port: config.PORT });
    logger.info("Server listening", {
      host: config.HOST,
      port: config.PORT,
      name: packageInfo.name,
      version: packageInfo.version,
    });
  } catch (error) {
    handleFatalError(error);
  }
};

await start().catch((error: unknown) => {
  console.error("Failed to start application:", error);
  process.exit(1);
});
