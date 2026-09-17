import { defineRoute, ProblemJson } from "@pagopa/hexagonal-core";
import { mountFastifyRoute } from "@pagopa/hexagonal-fastify";
import { FastifyInstance } from "fastify";

import { makeGetSessionUseCase } from "../../../application/use-cases/get-session.use-case.js";
import { AuthenticationMiddleware } from "../../../middlewares/authentication/index.js";
import {
  GetSessionInputDTO,
  GetSessionOutputDTO,
} from "../dtos/get-session.dto.js";

export const getSessionContract = defineRoute({
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
  security: [{ bearerAuth: [] }],
});

type GetSessionHandlerDeps = {
  middlewares: readonly [AuthenticationMiddleware<"session">];
  useCase: ReturnType<typeof makeGetSessionUseCase>;
};

export const mountGetSessionHandler =
  (deps: GetSessionHandlerDeps) =>
  (server: FastifyInstance): void => {
    mountFastifyRoute(server, {
      contract: getSessionContract,
      middlewares: deps.middlewares,
      inputMapper: (req, context) => ({
        sessionToken: context.sessionToken,
        session: context.session,
        fieldsFilter: req.query.fields,
      }),
      useCase: deps.useCase,
    });
  };

// Widened for the OpenAPI generator: exporting the inferred contract type would
// leak the branded `unique symbol` of `GetSessionOutputDTO` (TS2527).
// export const getSessionRoute: AnyRouteContract = getSessionContract;
