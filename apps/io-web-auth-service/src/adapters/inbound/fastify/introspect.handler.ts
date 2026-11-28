import { defineRoute, ProblemJson } from "@pagopa/hexagonal-core";
import { mountFastifyRoute } from "@pagopa/hexagonal-fastify";
import { FastifyInstance } from "fastify";

import {
  IntrospectionInput,
  makeIntrospectionUseCase,
} from "../../../application/use-cases/introspection.use-case.js";
import {
  IntrospectActiveResponseDTO,
  IntrospectInactiveResponseDTO,
  IntrospectInputDTO,
} from "../dtos/introspect.dto.js";

export const introspectContract = defineRoute({
  method: "post",
  operationId: "introspect",
  path: "/introspect",
  request: IntrospectInputDTO,
  summary: "Introspect a session token",
  description:
    "Verifies the session token provided in the request body and checks that it has not been invalidated. On success it returns the user data carried by the token.",
  tags: ["session"],
  // The token to introspect is the request payload itself.
  security: [],
  response: {
    200: {
      description: "The session token is valid.",
      schema: IntrospectActiveResponseDTO,
    },
    400: {
      description: "Bad request",
      schema: ProblemJson,
    },
    401: {
      description: "Unauthorized",
      schema: ProblemJson,
    },
    403: {
      description: "The session token has been invalidated.",
      schema: IntrospectInactiveResponseDTO,
    },
    500: {
      description: "Internal error",
      schema: ProblemJson,
    },
  },
});

export type IntrospectHandlerDeps = {
  introspectionUseCase: ReturnType<typeof makeIntrospectionUseCase>;
};

export const mountIntrospectHandler = (
  server: FastifyInstance,
  deps: IntrospectHandlerDeps,
): void => {
  mountFastifyRoute(server, {
    contract: introspectContract,
    inputMapper: (req, _context): IntrospectionInput => ({
      token: req.body.token,
    }),
    useCase: deps.introspectionUseCase,
  });
};
