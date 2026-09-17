import { defineRoute, ProblemJson } from "@pagopa/hexagonal-core";
import { mountFastifyRoute } from "@pagopa/hexagonal-fastify";
import type { AnyRouteContract } from "@pagopa/hexagonal-openapi";
import { FastifyInstance } from "fastify";

import { GetUserForFimsUseCase } from "../../../application/use-cases/get-user-for-fims.use-case.js";
import { AuthenticationMiddleware } from "../../../middlewares/authentication/index.js";
import { SsoFimsUserOutputDTO } from "../dtos/sso-fims-user.dto.js";

import { createCheckIpHook } from "./hooks/check-ip.hook.js";


const ssoFimsUserContract = defineRoute({
  method: "get",
  operationId: "getUserForFims",
  path: `/sso/fims/v2/user`,
  request: {},
  summary: "Return the FIMS user for a session token",
  description:
    "Returns the FIMS user identified by the token carried in the `Authorization: Bearer` header. Requests whose source IP is not within the configured allowlist are rejected with `401 Unauthorized`.",
  tags: ["sso"],
  response: {
    200: {
      description: "The FIMS user for the provided session token",
      schema: SsoFimsUserOutputDTO,
    },
    400: {
      description: "Bad request",
      schema: ProblemJson,
    },
    401: {
      description:
        "Missing/invalid `Authorization` header, unknown session, or source IP blocked by the allowlist.",
      schema: ProblemJson,
    },
    500: {
      description: "Internal error",
      schema: ProblemJson,
    },
  },
  security: [{ bearerAuth: [] }],
});

export type SsoFimsUserHandlerDeps = {
  allowedIpSourceRange: ReadonlyArray<string>;
  middlewares: readonly [AuthenticationMiddleware<"fims">];
  useCase: GetUserForFimsUseCase;
};

export const mountSsoFimsUserHandler = (
  server: FastifyInstance,
  deps: SsoFimsUserHandlerDeps,
): void => {
  // Fastify plugin scope: the check-ip preHandler stays confined to this route.
  server.register((scope, _opts, done) => {
    scope.addHook("preHandler", createCheckIpHook(deps.allowedIpSourceRange));
    mountFastifyRoute(scope, {
      contract: ssoFimsUserContract,
      middlewares: deps.middlewares,
      inputMapper: (_, context) => ({
        session: context.session,
      }),
      useCase: deps.useCase,
    });
    done();
  });
};

// Widened for the OpenAPI generator: exporting the inferred contract type would
// leak the branded `unique symbol` of `SsoFimsUserOutputDTO` (TS2527).
export const ssoFimsUserRoute: AnyRouteContract = ssoFimsUserContract;
