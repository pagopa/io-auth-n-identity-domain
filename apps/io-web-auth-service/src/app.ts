import { type PackageInfo } from "@pagopa/io-package-info";
import fastify, { type FastifyInstance } from "fastify";

import { type Config } from "./domain/value-objects/configs/index.js";
import { mountHealthCheckHandler } from "./adapters/inbound/fastify/health-check.handler.js";
import { getHealthCheckUseCase } from "./application/use-cases/health-check.use-case.js";

export const createApp = async (
  _config: Config,
  packageInfo: PackageInfo,
): Promise<{ server: FastifyInstance }> => {
  const server = fastify({ trustProxy: true });

  mountHealthCheckHandler("liveness")(
    server,
    getHealthCheckUseCase(packageInfo, []),
  );

  mountHealthCheckHandler("readiness")(
    server,
    getHealthCheckUseCase(packageInfo, []),
  );

  return { server };
};
