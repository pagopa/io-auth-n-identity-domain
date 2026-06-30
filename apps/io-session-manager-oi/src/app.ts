import { RouteRegistry } from "@pagopa/io-core-openapi";
import fastify, { type FastifyInstance } from "fastify";

import { mountReservePubKeyHandler } from "./adapters/inbound/fastify/reserve-pub-key.handler.js";
import { createLollipopAdapter } from "./adapters/outbound/lollipop.js";
import { getHealthCheckUseCase } from "./application/use-cases/health-check.use-case.js";
import { reserveLollipopPubKeyUseCase } from "./application/use-cases/reserve-lollipop-pub-key.use-case.js";
import {
  LollipopConfig,
  type Config,
} from "./domain/entities/config.entity.js";
import { ConfigError } from "@pagopa/io-env-config";
import { type PackageInfo } from "@pagopa/io-package-info";
import { mountHealthCheckHandler } from "./adapters/inbound/fastify/health-check.handler.js";

export const createApp = (
  config: Config,
  packageInfo: PackageInfo,
): {
  registry: RouteRegistry;
  server: FastifyInstance;
} => {
  const server = fastify({
    trustProxy: true, // Enable trust proxy to get correct client IPs behind proxies (necessary for check-ip hook)
  });
  const registry = new RouteRegistry();

  const lollipopAdapter = createLollipopAdapter(
    config satisfies LollipopConfig,
  );

  mountHealthCheckHandler(
    server,
    getHealthCheckUseCase(packageInfo, [lollipopAdapter]),
    registry,
  );

  // TODO: remove this endpoint and the related code
  // This is an endpoint only used for development and testing purposes, to reserve a lollipop public key for the current login attempt.
  mountReservePubKeyHandler(
    server,
    reserveLollipopPubKeyUseCase(lollipopAdapter),
    registry,
  );

  return { registry, server };
};
