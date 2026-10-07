import { defineRoute, ProblemJson } from "@pagopa/hexagonal-core";
import { mountFastifyRoute } from "@pagopa/hexagonal-fastify";
import type { AnyRouteContract } from "@pagopa/hexagonal-openapi";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { makeGenerateNonceUseCase } from "../../../application/use-cases/generate-nonce.use-case.js";
import { BASE_PATH } from "../base-path.js";

const generateNonceContract = defineRoute({
  method: "post",
  operationId: "lvGenerateNonce",
  path: `${BASE_PATH}/fast-login/nonce/generate`,
  request: {},
  summary: "Generate a Nonce for a session refresh flow",
  security: [],
  response: {
    200: {
      description: "Success response",
      schema: z.object({ nonce: z.uuid() }),
    },
    500: {
      description: "Server error",
      schema: ProblemJson,
    },
  },
});

export const mountGenerateNonceHandler = (
  server: FastifyInstance,
  useCase: ReturnType<typeof makeGenerateNonceUseCase>,
): void => {
  mountFastifyRoute(server, {
    contract: generateNonceContract,
    inputMapper: () => ({}),
    useCase,
  });
};

export const generateNonceRoute: AnyRouteContract = generateNonceContract;
