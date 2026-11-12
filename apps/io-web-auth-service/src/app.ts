import type { NonEmptyString } from "@pagopa/hexagonal-core";
import { type PackageInfo } from "@pagopa/io-package-info";
import { createRedisNodeClient } from "@pagopa/redis/node-client";
import fastify, { type FastifyInstance } from "fastify";

import { type Config } from "./domain/value-objects/configs/index.js";
import { mountHealthCheckHandler } from "./adapters/inbound/fastify/health-check.handler.js";
import { getHealthCheckUseCase } from "./application/use-cases/health-check.use-case.js";
import { getLogger } from "./telemetry-client.js";

export const createApp = async (
  config: Config,
  packageInfo: PackageInfo,
): Promise<{ server: FastifyInstance }> => {
  const server = fastify({ trustProxy: true });
  const logger = getLogger("gab-io-web-auth-service" as NonEmptyString);

  mountHealthCheckHandler("liveness")(
    server,
    getHealthCheckUseCase(packageInfo, []),
  );

  mountHealthCheckHandler("readiness")(
    server,
    getHealthCheckUseCase(packageInfo, []),
    logger,
  );

  const redisClient = config.REDIS_HOST
    ? await createRedisNodeClient({
        hostname: config.REDIS_HOST,
        port: config.REDIS_PORT,
        password: config.REDIS_PASSWORD,
        enableTls: config.REDIS_TLS_ENABLED,
      })
    : undefined;
  if (redisClient) {
    server.addHook("onClose", async () => {
      await redisClient.close();
    });
  }

  // TEMPORARY: used to verify outbound dependencies are traced in App Insights
  server.get("/debug/dependency", async (_request, reply) => {
    const response = await fetch(
      "https://jsonplaceholder.typicode.com/todos/1",
    );
    const body: unknown = await response.json();
    // INCR creates the key with value 0 if it does not exist
    const calls = await redisClient?.incr(
      "io-web-auth-service:dependency-calls",
    );

    logger.trackEvent({
      name: "EVENT_TEST",
      properties: {
        foo: "bar",
        integer: -1,
        flag: true,
      },
    });
    return reply.status(response.status).send({ calls, body });
  });

  return { server };
};
