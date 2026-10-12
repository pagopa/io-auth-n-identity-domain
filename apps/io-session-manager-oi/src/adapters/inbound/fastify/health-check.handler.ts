import { defineRoute, ProblemJson } from "@pagopa/hexagonal-core";
import { mountFastifyRoute } from "@pagopa/hexagonal-fastify";
import type { FastifyInstance } from "fastify";

import { getHealthCheckUseCase } from "../../../application/use-cases/health-check.use-case.js";
import { BASE_PATH } from "../base-path.js";
import { HealthCheckResponseDto } from "../dtos/health-check.dto.js";

type HealthCheckType = "liveness" | "readiness";
type HealthCheckContractTemplate = {
  description: string;
  path: string;
  operationId: string;
};

const healthCheckContractTemplates: Record<
  HealthCheckType,
  HealthCheckContractTemplate
> = {
  readiness: {
    description:
      "Check if the application is ready to serve requests. Returns the application name, version, and health status.",
    path: `${BASE_PATH}/health/readiness`,
    operationId: "getReadiness",
  },
  liveness: {
    description:
      "Check if the application is alive. Returns the application name and version.",
    path: `${BASE_PATH}/health/liveness`,
    operationId: "getLiveness",
  },
};

const healthcheckContract = (
  healthCheckContractTemplate: HealthCheckContractTemplate,
) =>
  defineRoute({
    method: "get",
    operationId: healthCheckContractTemplate.operationId,
    path: healthCheckContractTemplate.path,
    request: {},
    response: {
      200: {
        description: "Application info returned successfully.",
        schema: HealthCheckResponseDto,
      },
      500: ProblemJson,
    },
  });

/**
 * Mounts the `getHealthCheck` route. The contract declares no errors, so the use
 * case error union must be `never` (the use case cannot fail).
 */
export const mountHealthCheckHandler =
  (type: HealthCheckType) =>
  (
    server: FastifyInstance,
    useCase: ReturnType<typeof getHealthCheckUseCase>,
  ): void => {
    mountFastifyRoute(server, {
      contract: healthcheckContract(healthCheckContractTemplates[type]),
      inputMapper: () => ({}),
      useCase,
    });
  };
