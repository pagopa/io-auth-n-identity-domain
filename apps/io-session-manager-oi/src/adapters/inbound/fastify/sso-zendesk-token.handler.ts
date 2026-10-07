import { defineRoute, ProblemJson } from "@pagopa/hexagonal-core";
import { mountFastifyRoute } from "@pagopa/hexagonal-fastify";
import type { AnyRouteContract } from "@pagopa/hexagonal-openapi";
import { FastifyInstance } from "fastify";

import { GetTokenForZendeskUseCase } from "../../../application/use-cases/get-token-for-zendesk.use-case.js";
import { AuthenticationMiddleware } from "../../../middlewares/authentication/index.js";
import { SSO_ZENDESK_BASE_PATH } from "../base-path.js";
import {
  SsoZendeskTokenInputDTO,
  SsoZendeskTokenOutputDTO,
} from "../dtos/sso-zendesk-token.dto.js";

import { createCheckIpHook } from "./hooks/check-ip.hook.js";

const ssoZendeskTokenContract = defineRoute({
  method: "post",
  operationId: "getJwtForZendesk",
  path: `${SSO_ZENDESK_BASE_PATH}/jwt`,
  request: {
    body: SsoZendeskTokenInputDTO.body,
  },
  summary: "Get a Zendesk support token",
  description:
    "Returns a JWT with the authenticated user's data for Zendesk. Requests whose source IP is not within the configured allowlist are rejected.",
  tags: ["sso"],
  response: {
    200: {
      description: "Zendesk support token.",
      schema: SsoZendeskTokenOutputDTO,
    },
    400: {
      description: "Bad request",
      schema: ProblemJson,
    },
    401: {
      description:
        "Missing/invalid user token, unknown session, or source IP blocked by the allowlist.",
      schema: ProblemJson,
    },
    422: {
      description:
        "Unprocessable Content: the user has an unverified or missing email.",
      schema: ProblemJson,
    },
    500: {
      description: "Internal error",
      schema: ProblemJson,
    },
  },
});

export type SsoZendeskTokenHandlerDeps = {
  allowedIpSourceRange: ReadonlyArray<string>;
  middlewares: readonly [AuthenticationMiddleware<"zendesk">];
  useCase: GetTokenForZendeskUseCase;
};

export const mountSsoZendeskTokenHandler = (
  server: FastifyInstance,
  deps: SsoZendeskTokenHandlerDeps,
): void => {
  server.register((scope, _opts, done) => {
    scope.addHook("preHandler", createCheckIpHook(deps.allowedIpSourceRange));
    mountFastifyRoute(scope, {
      contract: ssoZendeskTokenContract,
      middlewares: deps.middlewares,
      inputMapper: (_, context) => ({
        session: context.session,
      }),
      useCase: deps.useCase,
    });
    done();
  });
};

export const ssoZendeskTokenRoute: AnyRouteContract = ssoZendeskTokenContract;
