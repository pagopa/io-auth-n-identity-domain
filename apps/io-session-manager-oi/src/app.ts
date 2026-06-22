import fastify, { type FastifyInstance } from "fastify";

import { RouteRegistry } from "@pagopa/io-core-openapi";

import type { Config } from "./domain/entities/config.js";
import { mountInfoHandler } from "./adapters/inbound/fastify/info.handler.js";
import { getInfoUseCase } from "./application/use-cases/info.use-case.js";

export const createApp = (
  config: Config,
): {
  registry: RouteRegistry;
  server: FastifyInstance;
} => {
  const server = fastify();
  const registry = new RouteRegistry();

  // --- Dependency wiring ---

  // --- HTTP function registrations ---
  mountInfoHandler(server, getInfoUseCase);

  return { registry, server };
};
