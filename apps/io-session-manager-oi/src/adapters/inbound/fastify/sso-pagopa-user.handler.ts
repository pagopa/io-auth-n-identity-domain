import { defineRoute, ProblemJson } from "@pagopa/hexagonal-core";
import { mountFastifyRoute } from "@pagopa/hexagonal-fastify";
import type { AnyRouteContract } from "@pagopa/hexagonal-openapi";
import { FastifyInstance } from "fastify";

import { GetUserForPagoPaUseCase } from "../../../application/use-cases/get-user-for-pagopa.use-case.js";
import { AuthenticationMiddleware } from "../../../middlewares/authentication/index.js";
import { SSO_PAGOPA_BASE_PATH } from "../base-path.js";
import { SsoPagoPaUserOutputDTO } from "../dtos/sso-pagopa-user.dto.js";

import { createCheckIpHook } from "./hooks/check-ip.hook.js";

const ssoPagoPaUserContract = defineRoute({
  method: "get",
  operationId: "getUserForPagoPa",
  path: `${SSO_PAGOPA_BASE_PATH}/user`,
  request: {},
  summary: "Return the PagoPa user for a session token",
  description:
    "Returns the PagoPa user identified by the token carried in the `Authorization: Bearer` header. Requests whose source IP is not within the configured allowlist are rejected with `401 Unauthorized`.",
  tags: ["sso"],
  response: {
    200: {
      description: "The PagoPa user for the provided session token",
      schema: SsoPagoPaUserOutputDTO,
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

export type SsoPagoPaUserHandlerDeps = {
  allowedIpSourceRange: ReadonlyArray<string>;
  middlewares: readonly [AuthenticationMiddleware<"pagopa">];
  useCase: GetUserForPagoPaUseCase;
};

export const mountSsoPagoPaUserHandler = (
  server: FastifyInstance,
  deps: SsoPagoPaUserHandlerDeps,
): void => {
  // Fastify plugin scope: the check-ip preHandler stays confined to this route.
  server.register((scope, _opts, done) => {
    scope.addHook("preHandler", createCheckIpHook(deps.allowedIpSourceRange));
    mountFastifyRoute(scope, {
      contract: ssoPagoPaUserContract,
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
// leak the branded `unique symbol` of `SsoPagoPaUserOutputDTO` (TS2527).
export const ssoPagoPaUserRoute: AnyRouteContract = ssoPagoPaUserContract;
