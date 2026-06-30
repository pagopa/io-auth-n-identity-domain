import { mountFastifyRoute } from "@pagopa/io-core-adapter-fastify";
import type { RouteRegistry } from "@pagopa/io-core-openapi";
import { defineRoute } from "@pagopa/io-core-openapi";
import type { FastifyInstance } from "fastify";

import { getInfoUseCase } from "../../../application/use-cases/info.use-case.js";
import { InfoOutputSchema } from "../dtos/info.dto.js";
import { getHealthCheckUseCase } from "../../../application/use-cases/healthcheck.use-case.js";

const healthcheckContract = defineRoute({
  description: "Returns the application name, version, and health status.",
  method: "get",
  operationId: "getHealthcheck",
  path: "/api/healthcheck",
  request: {},
  response: {
    200: {
      description: "Application info returned successfully.",
      schema: InfoOutputSchema,
    },
    500: {
      description: "Internal server error.",
      schema: InfoOutputSchema,
    },
  },
  summary: "Health check / application info",
  tags: ["Info"],
});

/**
 * Mounts the `getHealthCheck` route. The contract declares no errors, so the use
 * case error union must be `never` (the use case cannot fail).
 */
export const mountHealthCheckHandler = (
  server: FastifyInstance,
  useCase: ReturnType<typeof getHealthCheckUseCase>,
  registry?: RouteRegistry,
): void => {
  mountFastifyRoute(server, {
    contract: healthcheckContract,
    registry,
    transformInput: () => ({}),
    useCase,
  });
};
