import type { PackageInfo } from "@pagopa/io-package-info";
import fastify, { type FastifyInstance } from "fastify";

import { mountHealthCheckHandler } from "./adapters/inbound/fastify/health-check.handler.js";
import { getHealthCheckUseCase } from "./application/use-cases/health-check.use-case.js";
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

const mountHealthChecks = (
  server: FastifyInstance,
  packageInfo: PackageInfo,
) => {
  mountHealthCheckHandler("liveness")(
    server,
    getHealthCheckUseCase(packageInfo),
  );
  mountHealthCheckHandler("readiness")(
    server,
    getHealthCheckUseCase(packageInfo),
  );
};

const mountRoutes = (_options: {
  server: FastifyInstance;
  config: Config;
}): void => {
  // Application routes will be registered here.
};

export const createApp = async (
  config: Config,
  packageInfo: PackageInfo,
): Promise<{ server: FastifyInstance }> => {
  const server = fastify();
  const lifecycle = createResourceLifecycle(server);

  try {
    server.addHook("onClose", lifecycle.cleanupResources);

    mountHealthChecks(server, packageInfo);
    mountRoutes({ server, config });

    return { server };
  } catch (error) {
    await lifecycle.cleanupResources();
    await lifecycle.closeServer();
    throw error;
  }
};
