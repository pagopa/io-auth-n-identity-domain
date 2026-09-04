import { defineRoute, ProblemJson } from "@pagopa/hexagonal-core";
import { mountFastifyRoute } from "@pagopa/hexagonal-fastify";
import { FastifyInstance } from "fastify";

import { makeGetSessionUseCase } from "../../../application/use-cases/get-session.use-case.js";
import {
  GetSessionInputDTO,
  GetSessionOutputDTO,
} from "../dtos/get-session.dto.js";

const getSessionContract = defineRoute({
  operationId: "getSession",
  method: "get",
  path: "/api/auth/v2/session",
  request: GetSessionInputDTO,
  response: {
    200: {
      description: "Session info returned successfully.",
      schema: GetSessionOutputDTO,
    },
    400: {
      description: "Bad request",
      schema: ProblemJson,
    },
    401: {
      description: "Bearer token null or expired",
      schema: ProblemJson,
    },
    500: {
      description: "Internal error",
      schema: ProblemJson,
    },
  },
});

type GetSessionHandlerDeps = {
  useCase: ReturnType<typeof makeGetSessionUseCase>;
};

export const mountGetSessionHandler =
  (deps: GetSessionHandlerDeps) =>
  (server: FastifyInstance): void => {
    mountFastifyRoute(server, {
      contract: getSessionContract,
      inputMapper: (req) => ({
        ...req.headers.authorization,
        fieldsFilter: req.query.fields,
      }),
      useCase: deps.useCase,
    });
  };
