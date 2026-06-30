import { RouteRegistry } from "@pagopa/io-core-openapi";
import fastify, { type FastifyInstance } from "fastify";

import { mountInfoHandler } from "./adapters/inbound/fastify/info.handler.js";
import { mountReservePubKeyHandler } from "./adapters/inbound/fastify/reserve-pub-key.handler.js";
import { createLollipopAdapter } from "./adapters/outbound/lollipop.js";
import { getInfoUseCase } from "./application/use-cases/info.use-case.js";
import { reserveLollipopPubKeyUseCase } from "./application/use-cases/reserve-lollipop-pub-key.use-case.js";
import { ConfigSchema, type Config } from "./domain/entities/config.entity.js";
import { ConfigError } from "@pagopa/io-env-config";
import { Result } from "neverthrow";
import { createPackageInfoAdapter } from "@pagopa/io-package-info";
import { createConfigLoader } from "./adapters/outbound/config-loader.js";

export const createApp = (
  configResult: Result<Config, ConfigError>,
): {
  registry: RouteRegistry;
  server: FastifyInstance;
} => {
  const server = fastify({
    trustProxy: true, // Enable trust proxy to get correct client IPs behind proxies (necessary for check-ip hook)
  });
  const registry = new RouteRegistry();

  const packageInfoAdapter = createPackageInfoAdapter(
    new URL("../package.json", import.meta.url).pathname,
  );

  mountInfoHandler(server, getInfoUseCase, [packageInfoAdapter, []], registry);

  const lollipopAdapter = createLollipopAdapter(
    createConfigLoader(LollipopConfigSchema).load(),
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
