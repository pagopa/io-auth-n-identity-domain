import { defineRoute, ProblemJson } from "@pagopa/hexagonal-core";
import { mountFastifyRoute } from "@pagopa/hexagonal-fastify";
import { FastifyInstance } from "fastify";

import {
  makeHandleOidcCallbackUseCase,
  type HandleOidcCallbackInput,
} from "../../../application/use-cases/handle-oidc-callback.use-case.js";
import { CallbackInputDTO } from "../dtos/callback.dto.js";
import { extractIpMiddleware } from "./middlewares/extract-ip.middleware.js";

const callbackContract = defineRoute({
  method: "get",
  path: "/api/auth/v2/callback",
  request: CallbackInputDTO,
  response: {
    302: {
      description:
        "Redirect to the client carrying the freshly minted session token.",
      redirect: true,
      headers: {
        Location: {
          description: "Client redirect URL carrying the session token.",
          schema: { type: "string" },
        },
      },
    },
    400: {
      description: "Bad request",
      schema: ProblemJson,
    },
    401: {
      description: "Unauthorized",
      schema: ProblemJson,
    },
    500: {
      description: "Internal error",
      schema: ProblemJson,
    },
  },
});

export type CallbackHandlerDeps = {
  handleOidcCallbackUseCase: ReturnType<typeof makeHandleOidcCallbackUseCase>;
  loginSuccessRedirectUrl: string;
};

export const mountCallbackHandler = (
  server: FastifyInstance,
  deps: CallbackHandlerDeps,
): void => {
  mountFastifyRoute(server, {
    contract: callbackContract,
    middlewares: [extractIpMiddleware] as const,
    inputMapper: (req, context): HandleOidcCallbackInput => ({
      query: req.query,
      ipAddress: context.ipAddress,
    }),
    outputMapper: (clientSessionToken) => {
      const redirectUrl = new URL(deps.loginSuccessRedirectUrl);
      redirectUrl.hash = new URLSearchParams({
        token: clientSessionToken,
      }).toString();
      return redirectUrl.href;
    },
    useCase: deps.handleOidcCallbackUseCase,
  });
};
