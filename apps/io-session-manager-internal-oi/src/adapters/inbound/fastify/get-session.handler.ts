import { defineRoute, ProblemJson } from "@pagopa/hexagonal-core";
import { mountFastifyRoute } from "@pagopa/hexagonal-fastify";
import type { FastifyInstance } from "fastify";

import type { GetSessionUseCase } from "../../../application/use-cases/get-session.use-case.js";
import { BASE_PATH } from "../base-path.js";
import {
  GetSessionInputDTO,
  GetSessionOutputDTO,
} from "../dtos/get-session.dto.js";

const GetSessionContract = defineRoute({
  method: "get",
  path: `${BASE_PATH}/sessions/{fiscalCode}`,
  request: {
    path: GetSessionInputDTO,
  },
  response: {
    200: {
      description: "Session activity returned successfully.",
      schema: GetSessionOutputDTO,
    },
    400: {
      description: "Missing or invalid fiscal code.",
      schema: ProblemJson,
    },
    500: {
      description: "Error retrieving session activity.",
      schema: ProblemJson,
    },
  },
});

export const mountGetSessionHandler =
  (server: FastifyInstance, useCase: GetSessionUseCase): void => {
    mountFastifyRoute(server, {
      contract: GetSessionContract,
      middlewares: [], //TODO: add middleware in case of authenticated calls
      inputMapper: (req) => ({
        fiscalCode: req.path.fiscalCode,
      }),
      useCase: useCase,
    });
  };
