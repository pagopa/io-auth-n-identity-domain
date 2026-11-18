import { defineRoute, ProblemJson } from "@pagopa/hexagonal-core";
import { mountFastifyRoute } from "@pagopa/hexagonal-fastify";
import type { AnyRouteContract } from "@pagopa/hexagonal-openapi";
import { type FastifyInstance } from "fastify";

import {
  makeStartLoginUseCase,
  type StartLoginOutput,
} from "../../../application/use-cases/start-login.use-case.js";
import { LoginInputDTO } from "../dtos/login.dto.js";

import { extractIpMiddleware } from "./middlewares/extract-ip.middleware.js";

const loginContract = defineRoute({
  method: "get",
  operationId: "startLogin",
  path: "/login",
  request: LoginInputDTO,
  summary: "Start the OIDC login flow",
  description:
    "Prepares an OpenID Connect authorization request towards OneIdentity and redirects the client to its authorization endpoint.",
  tags: ["oidc"],
  // Public endpoint: bootstraps the OIDC login flow.
  security: [],
  response: {
    302: {
      description:
        "Redirect (`302`) to the OneIdentity authorization endpoint carrying the authorization request parameters in the query string.",
      redirect: true,
      headers: {
        Location: {
          description:
            "`<authorization_endpoint>?client_id=…&redirect_uri=…&scope=openid&state=…&nonce=…&response_type=code&acr_values=…&idp=…`",
          schema: { type: "string", format: "uri" },
        },
      },
    },
    400: {
      description: "Bad request",
      schema: ProblemJson,
    },
    500: {
      description: "Internal error",
      schema: ProblemJson,
    },
  },
});

/** Builds the OneIdentity authorization request URL. */
export const toAuthorizationRequestUrl = (output: StartLoginOutput): string => {
  const url = new URL(output.authorizationEndpoint);
  const parameters = {
    client_id: output.clientId,
    redirect_uri: output.redirectUri.href,
    scope: "openid",
    state: output.state,
    nonce: output.nonce,
    response_type: "code",
    acr_values: output.acrValues,
    idp: output.idp,
  };
  for (const [name, value] of Object.entries(parameters)) {
    url.searchParams.set(name, value);
  }
  return url.href;
};

export type LoginHandlerDeps = {
  middlewares: readonly [typeof extractIpMiddleware];
  useCase: ReturnType<typeof makeStartLoginUseCase>;
};

export const mountLoginHandler = (
  server: FastifyInstance,
  deps: LoginHandlerDeps,
): void => {
  mountFastifyRoute(server, {
    contract: loginContract,
    middlewares: deps.middlewares,
    inputMapper: (req, context) => ({
      oidcConfigurationEnv: req.query.env,
      minAuthLevel: req.query.min_auth_level,
      idp: req.query.idp,
      ipAddress: context.ipAddress,
    }),
    outputMapper: toAuthorizationRequestUrl,
    useCase: deps.useCase,
  });
};

// Widened for the OpenAPI generator.
export const loginRoute: AnyRouteContract = loginContract;
