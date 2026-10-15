import "dotenv/config";

import { fileURLToPath } from "node:url";

import { createPackageInfoAdapter } from "@pagopa/io-package-info";

import { createConfigLoader } from "./adapters/outbound/config-loader.js";
import { createApp } from "./app.js";
import { ConfigSchema } from "./domain/value-objects/configs/index.js";

const SHUTDOWN_TIMEOUT_MS = 10_000;

const bootstrap = () => {
  const configResult = createConfigLoader(ConfigSchema).load();
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

  return { config, packageInfo: packageInfoResult.value };
};

const registerLifecycle = (
  server: Awaited<ReturnType<typeof createApp>>["server"],
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
      console.error("Application shutdown timed out");
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);

    shutdownPromise = (async () => {
      try {
        await server.close();
      } catch (error) {
        console.error("Failed to close application:", error);
        process.exitCode = 1;
      } finally {
        clearTimeout(timeout);
        process.exit(process.exitCode ?? 0);
      }
    })();
    return shutdownPromise;
  };

  const handleFatalError = (error: unknown): void => {
    console.error("Fatal application error:", error);
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
  const { handleFatalError } = registerLifecycle(server);

  try {
    await server.listen({ host: config.HOST, port: config.PORT });
  } catch (error) {
    handleFatalError(error);
  }
};

await start().catch((error: unknown) => {
  console.error("Failed to start application:", error);
  process.exit(1);
});
