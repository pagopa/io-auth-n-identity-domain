import { defineRoute, ProblemJson } from "@pagopa/hexagonal-core";
import { mountFastifyRoute } from "@pagopa/hexagonal-fastify";
import type { FastifyInstance } from "fastify";

import type { GetSessionStateUseCase } from "../../../application/use-cases/get-session-state.use-case.js";
import { BASE_PATH } from "../base-path.js";
import {
  GetSessionStateInputDTO,
  GetSessionStateOutputDTO,
} from "../dtos/get-session-state.dto.js";

const GetSessionStateContract = defineRoute({
  method: "get",
  path: `${BASE_PATH}/sessions/{fiscalCode}/state`,
  request: {
    path: GetSessionStateInputDTO,
  },
  response: {
    200: {
      description: "User session state returned successfully.",
      schema: GetSessionStateOutputDTO,
    },
    400: {
      description: "Missing or invalid fiscal code.",
      schema: ProblemJson,
    },
    500: {
      description: "Error retrieving user session state.",
      schema: ProblemJson,
    },
  },
});

export const mountGetSessionStateHandler = (
  server: FastifyInstance,
  useCase: GetSessionStateUseCase,
): void => {
  mountFastifyRoute(server, {
    contract: GetSessionStateContract,
    middlewares: [], //TODO: add middleware in case of authenticated calls
    inputMapper: (req) => ({
      fiscalCode: req.path.fiscalCode,
    }),
    useCase,
  });
};
