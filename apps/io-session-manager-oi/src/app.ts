import { type PackageInfo } from "@pagopa/io-package-info";
import fastify, { type FastifyInstance } from "fastify";

import { mountHealthCheckHandler } from "./adapters/inbound/fastify/health-check.handler.js";
import { getHealthCheckUseCase } from "./application/use-cases/health-check.use-case.js";
import { type Config } from "./domain/value-objects/config.vo.js";

export const createApp = (
  config: Config,
  packageInfo: PackageInfo,
): {
  server: FastifyInstance;
} => {
  const server = fastify({
    trustProxy: true, // Enable trust proxy to get correct client IPs behind proxies (necessary for check-ip hook)
  });

  mountHealthCheckHandler(server, getHealthCheckUseCase(packageInfo, []));

  return { server };
};
