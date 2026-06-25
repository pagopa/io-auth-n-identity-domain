import { RouteRegistry } from "@pagopa/io-core-openapi";
import fastify, { type FastifyInstance } from "fastify";

import { mountInfoHandler } from "./adapters/inbound/fastify/info.handler.js";
import { getInfoUseCase } from "./application/use-cases/info.use-case.js";
import type { Config } from "./domain/entities/config.js";

export const createApp = (
  config: Config,
): {
  registry: RouteRegistry;
  server: FastifyInstance;
} => {
  const server = fastify({
    trustProxy: true, // Enable trust proxy to get correct client IPs behind proxies (necessary for check-ip hook)
  });
  const registry = new RouteRegistry();

  // --- HTTP function registrations ---
  mountInfoHandler(server, getInfoUseCase, registry);

  return { registry, server };
};
