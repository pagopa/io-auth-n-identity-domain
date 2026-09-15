import { defineRoute, ProblemJson } from "@pagopa/hexagonal-core";
import { mountFastifyRoute } from "@pagopa/hexagonal-fastify";
import type { AnyRouteContract } from "@pagopa/hexagonal-openapi";
import { FastifyInstance } from "fastify";

import { GetUserForBpdUseCase } from "../../../application/use-cases/get-user-for-bpd.use-case.js";
import {
  SsoBpdUserInputDTO,
  SsoBpdUserOutputDTO,
} from "../dtos/sso-bpd-user.dto.js";

import { AuthenticationMiddleware } from "../../../middlewares/authentication/index.js";
import { createCheckIpHook } from "./hooks/check-ip.hook.js";

const ssoBpdUserContract = defineRoute({
  method: "get",
  operationId: "getUserForBpd",
  path: `/sso/bpd/v2/user`,
  request: SsoBpdUserInputDTO,
  summary: "Return the BPD user for a session token",
  description:
    "Returns the BPD user identified by the token carried in the `Authorization: Bearer` header. Requests whose source IP is not within the configured allowlist are rejected with `401 Unauthorized`.",
  tags: ["sso"],
  response: {
    200: {
      description: "The BPD user for the provided session token",
      schema: SsoBpdUserOutputDTO,
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

export type SsoBpdUserHandlerDeps = {
  allowedIpSourceRange: ReadonlyArray<string>;
  middlewares: readonly [AuthenticationMiddleware<"bpd">];
  useCase: GetUserForBpdUseCase;
};

export const mountSsoBpdUserHandler = (
  server: FastifyInstance,
  deps: SsoBpdUserHandlerDeps,
): void => {
  // Fastify plugin scope: the check-ip preHandler stays confined to this route.
  server.register((scope, _opts, done) => {
    scope.addHook("preHandler", createCheckIpHook(deps.allowedIpSourceRange));
    mountFastifyRoute(scope, {
      contract: ssoBpdUserContract,
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
// leak the branded `unique symbol` of `SsoBpdUserOutputDTO` (TS2527).
export const ssoBpdUserRoute: AnyRouteContract = ssoBpdUserContract;
