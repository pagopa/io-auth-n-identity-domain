import "dotenv/config";

import { fileURLToPath } from "node:url";

import { createPackageInfoAdapter } from "@pagopa/io-package-info";

import { createConfigLoader } from "./adapters/outbound/config-loader.js";
import { createApp } from "./app.js";
import { ConfigSchema } from "./domain/value-objects/configs/index.js";

const SHUTDOWN_TIMEOUT_MS = 10_000;
let server: Awaited<ReturnType<typeof createApp>>["server"] | undefined;
let shutdownPromise: Promise<void> | undefined;

/**
 * Shares one shutdown operation across repeated signals and fatal errors.
 * Closes the server, when available, awaiting its onClose resource cleanup hooks.
 * A later failure overrides a successful exit status, never the reverse.
 * Forces exit with code 1 if cleanup fails or exceeds SHUTDOWN_TIMEOUT_MS.
 * @param exitCode 0 for a requested stop, 1 for a fatal error.
 */
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
      await server?.close();
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

// Termination requested by the orchestrator or kill: drain and clean up.
process.on("SIGTERM", () => void shutdown(0));
// Interactive interruption (Ctrl+C): use the same shutdown procedure.
process.on("SIGINT", () => void shutdown(0));
// Uncaught exceptions are fatal: attempt bounded cleanup, then exit with failure.
process.on("uncaughtException", handleFatalError);
// Treat promises rejected without a handler as fatal rather than log and continue.
process.on("unhandledRejection", handleFatalError);

const start = async () => {
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

  ({ server } = await createApp(config, packageInfoResult.value));
  await server.listen({
    host: config.HOST,
    port: config.PORT,
  });
};

await start().catch(handleFatalError);
