import { defineRoute, ProblemJson } from "@pagopa/hexagonal-core";
import { mountFastifyRoute } from "@pagopa/hexagonal-fastify";
import type { AnyRouteContract } from "@pagopa/hexagonal-openapi";
import { FastifyInstance } from "fastify";

import { GetLollipopUserForFimsUseCase } from "../../../application/use-cases/get-lollipop-user-for-fims.use-case.js";
import { AuthenticationMiddleware } from "../../../middlewares/authentication/index.js";
import { SSO_FIMS_BASE_PATH } from "../base-path.js";
import {
  SsoFimsLollipopUserInputDto,
  SsoFimsLollipopUserOutputDto,
} from "../dtos/sso-fims-lollipop-user.dto.js";

import { createCheckIpHook } from "./hooks/check-ip.hook.js";

const ssoFimsLollipopUserContract = defineRoute({
  method: "post",
  operationId: "getLollipopUserForFIMS",
  path: `${SSO_FIMS_BASE_PATH}/lollipop-user`,
  request: SsoFimsLollipopUserInputDto,
  summary: "Get user's data and generate LCParams",
  description:
    "Returns the user data needed by FIMS backend and the LCParams needed by the RC to verify the Lollipop request. Requests whose source IP is not within the configured allowlist are rejected with `401 Unauthorized`.",
  tags: ["sso"],
  response: {
    200: {
      description: "The FIMS user for the provided session token",
      schema: SsoFimsLollipopUserOutputDto,
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
    403: {
      description: "Forbidden - Not Authorized",
      schema: ProblemJson,
    },
    404: {
      description: "User or Lollipop data not found",
      schema: ProblemJson,
    },
    500: {
      description: "Internal error",
      schema: ProblemJson,
    },
  },
  security: [{ bearerAuth: [] }],
});

export type SsoLollipopFimsUserHandlerDeps = {
  allowedIpSourceRange: ReadonlyArray<string>;
  middlewares: readonly [AuthenticationMiddleware<"fims">];
  useCase: GetLollipopUserForFimsUseCase;
};

export const mountSsoFimsLollipopUserHandler = (
  server: FastifyInstance,
  deps: SsoLollipopFimsUserHandlerDeps,
): void => {
  // Fastify plugin scope: the check-ip preHandler stays confined to this route.
  server.register((scope, _opts, done) => {
    scope.addHook("preHandler", createCheckIpHook(deps.allowedIpSourceRange));
    mountFastifyRoute(scope, {
      contract: ssoFimsLollipopUserContract,
      middlewares: deps.middlewares,
      inputMapper: (req, context) => ({
        session: context.session,
        operationId: req.body.operation_id,
      }),
      outputMapper: ({ profile, lcParams }) => ({
        profile,
        lc_params: lcParams,
      }),
      useCase: deps.useCase,
    });
    done();
  });
};

// Widened for the OpenAPI generator: exporting the inferred contract type would
// leak the branded `unique symbol` of `SsoFimsUserOutputDTO` (TS2527).
export const ssoFimsLollipopUserRoute: AnyRouteContract =
  ssoFimsLollipopUserContract;
