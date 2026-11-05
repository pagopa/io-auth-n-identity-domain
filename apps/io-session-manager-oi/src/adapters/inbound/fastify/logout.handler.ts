import { defineRoute, ProblemJson } from "@pagopa/hexagonal-core";
import { mountFastifyRoute } from "@pagopa/hexagonal-fastify";
import type { AnyRouteContract } from "@pagopa/hexagonal-openapi";
import type { FastifyInstance } from "fastify";

import type { LogoutUseCase } from "../../../application/use-cases/logout.use-case.js";
import type { AuthenticationMiddleware } from "../../../middlewares/authentication/index.js";
import { BASE_PATH } from "../base-path.js";
import { LogoutOutputDTO } from "../dtos/logout.dto.js";

const logoutContract = defineRoute({
  operationId: "logout",
  method: "post",
  path: `${BASE_PATH}/logout`,
  request: {},
  summary: "Execute the logout",
  description: "Delete user's active session and tokens.",
  response: {
    200: {
      description: "Logout succeeded",
      schema: LogoutOutputDTO,
    },
    400: {
      description: "Bad request",
      schema: ProblemJson,
    },
    401: {
      description: "Token null or expired.",
      schema: ProblemJson,
    },
    500: {
      description: "There was an error logging out the user.",
      schema: ProblemJson,
    },
  },
  security: [{ bearerAuth: [] }],
});

type LogoutHandlerDeps = {
  middlewares: readonly [AuthenticationMiddleware<"session">];
  useCase: LogoutUseCase;
};

export const mountLogoutHandler =
  (deps: LogoutHandlerDeps) =>
  (server: FastifyInstance): void => {
    mountFastifyRoute(server, {
      contract: logoutContract,
      middlewares: deps.middlewares,
      inputMapper: (_, context) => ({
        session: context.session,
      }),
      outputMapper: (): LogoutOutputDTO => ({ message: "ok" }),
      useCase: deps.useCase,
    });
  };

export const logoutRoute: AnyRouteContract = logoutContract;
