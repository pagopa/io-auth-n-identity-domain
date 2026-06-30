import { defineRoute } from "@pagopa/hexagonal-core";
import { mountFastifyRoute } from "@pagopa/hexagonal-fastify";
import type { FastifyInstance } from "fastify";

import { getHealthCheckUseCase } from "../../../application/use-cases/health-check.use-case.js";
import { HealthCheckOutputSchema } from "../dtos/health-check.dto.js";

const healthcheckContract = defineRoute({
  description: "Returns the application name, version, and health status.",
  method: "get",
  operationId: "getHealthcheck",
  path: "/api/healthcheck",
  request: {},
  response: {
    200: {
      description: "Application info returned successfully.",
      schema: HealthCheckOutputSchema,
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
): void => {
  mountFastifyRoute(server, {
    contract: healthcheckContract,
    inputMapper: () => ({}),
    useCase,
  });
};
