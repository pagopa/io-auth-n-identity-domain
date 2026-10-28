import {
  defineRoute,
  NonEmptyStringBrand,
  ProblemJson,
} from "@pagopa/hexagonal-core";
import { mountFastifyRoute } from "@pagopa/hexagonal-fastify";
import type { AnyRouteContract } from "@pagopa/hexagonal-openapi";
import type { FastifyInstance } from "fastify";

import { makeFastLoginUseCase } from "../../../application/use-cases/fast-login.use-case.js";
import { BASE_PATH } from "../base-path.js";
import {
  FastLoginInputDTO,
  FastLoginOutputDTO,
} from "../dtos/fast-login.dto.js";


import { extractIpMiddleware } from "./middlewares/extract-ip.middleware.js";
import type { OptionalSessionMiddleware } from "./middlewares/optional-session.middleware.js";

const _brands = [NonEmptyStringBrand];

export const fastLoginContract = defineRoute({
  method: "post",
  operationId: "fastLogin",
  path: `${BASE_PATH}/fast-login`,
  request: FastLoginInputDTO,
  summary: "Create a session using Lollipop Fast Login",
  description:
    "Validates the signed Lollipop request through Fast Login and creates a new user session.",
  tags: ["oidc"],
  security: [],
  response: {
    200: {
      description: "Fast Login succeeded and a new session was created.",
      schema: FastLoginOutputDTO,
    },
    400: { description: "Bad request", schema: ProblemJson },
    401: {
      description:
        "Invalid or expired Lollipop request, invalid session token, blocked user, or mismatched user identity.",
      schema: ProblemJson,
    },
    403: {
      description:
        "Fast Login is disabled or the Lollipop key is not authorized.",
      schema: ProblemJson,
    },
    500: { description: "Internal error", schema: ProblemJson },
  },
});

export type FastLoginHandlerDeps = {
  middlewares: {
    optionalSessionMiddleware: OptionalSessionMiddleware;
    extractIpMiddleware: typeof extractIpMiddleware;
  }
  useCase: ReturnType<typeof makeFastLoginUseCase>;
};

export const mountFastLoginHandler = (
  server: FastifyInstance,
  deps: FastLoginHandlerDeps,
): void => {
  mountFastifyRoute(server, {
    contract: fastLoginContract,
    middlewares: [
      deps.middlewares.optionalSessionMiddleware,
      deps.middlewares.extractIpMiddleware,
    ] as const,
    inputMapper: (req, context) => {
      const currentUser =
        "session" in context ? context.session.fiscalCode : undefined;
      return {
        originalMethod: req.headers["x-pagopa-lollipop-original-method"],
        originalUrl: req.headers["x-pagopa-lollipop-original-url"],
        signatureInput: req.headers["signature-input"],
        signature: req.headers["signature"],
        clientIp: context.ipAddress,
        ...(currentUser ? { currentUser } : {}),
      };
    },
    useCase: deps.useCase,
  });
};

export const fastLoginRoute: AnyRouteContract = fastLoginContract;
