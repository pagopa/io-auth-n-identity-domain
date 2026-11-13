import { defineRoute, ProblemJson } from "@pagopa/hexagonal-core";
import { mountFastifyRoute } from "@pagopa/hexagonal-fastify";
import type { FastifyInstance } from "fastify";

import {
  getHealthCheckUseCase,
  HealthCheckOutputSchema,
} from "../../../application/use-cases/health-check.use-case.js";
import { BASE_PATH } from "../base-path.js";

type HealthCheckType = "liveness" | "readiness";

const healthcheckContract = (type: HealthCheckType) =>
  defineRoute({
    method: "get",
    path: `${BASE_PATH}/health/${type}`,
    request: {},
    response: {
      200: {
        description: "Application info returned successfully.",
        schema: HealthCheckOutputSchema,
      },
      500: ProblemJson,
    },
  });

export const mountHealthCheckHandler =
  (type: HealthCheckType) =>
  (
    server: FastifyInstance,
    useCase: ReturnType<typeof getHealthCheckUseCase>,
  ): void => {
    mountFastifyRoute(server, {
      contract: healthcheckContract(type),
      inputMapper: () => ({}),
      useCase,
    });
  };
