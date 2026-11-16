import type { NonEmptyString } from "@pagopa/hexagonal-core";
import { type PackageInfo } from "@pagopa/io-package-info";
import fastify, { type FastifyInstance } from "fastify";

import { type Config } from "./domain/value-objects/configs/index.js";
import { mountHealthCheckHandler } from "./adapters/inbound/fastify/health-check.handler.js";
import { getHealthCheckUseCase } from "./application/use-cases/health-check.use-case.js";
import { getLogger } from "./telemetry-client.js";

export const createApp = async (
  _config: Config,
  packageInfo: PackageInfo,
): Promise<{ server: FastifyInstance }> => {
  const server = fastify({ trustProxy: true });
  //@typescript-eslint/no-unused-vars: disable-next-line
  const logger = getLogger(packageInfo.name as NonEmptyString);

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
