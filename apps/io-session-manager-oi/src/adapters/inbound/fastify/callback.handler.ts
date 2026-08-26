import { defineRoute, ProblemJson } from "@pagopa/hexagonal-core";
import { mountFastifyRoute } from "@pagopa/hexagonal-fastify";
import { FastifyInstance } from "fastify";

import {
  makeHandleOidcCallbackUseCase,
  type HandleOidcCallbackInput,
} from "../../../application/use-cases/handle-oidc-callback.use-case.js";
import { CallbackInputDTO } from "../dtos/callback.dto.js";
import { extractIpMiddleware } from "./middlewares/extract-ip.middleware.js";

export const callbackContract = defineRoute({
  method: "get",
  operationId: "callback",
  path: "/api/auth/v2/callback",
  request: CallbackInputDTO,
  summary: "Handle the OIDC callback",
  description:
    "Handles the OpenID Connect callback from the identity provider. On success it mints a fresh session token and redirects the client to the success URL carrying the token; on a login error it redirects to the error URL carrying the error code.",
  tags: ["oidc"],
  // Public endpoint: part of the pre-authentication OIDC login flow.
  security: [],
  response: {
    302: {
      description:
        "Redirect (`302`) back to the client; the outcome is encoded in the `Location` URL.\n" +
        "- **Success** — the success redirect URL with the freshly minted session token in the URL **fragment**: `<successUrl>#token=<sessionToken>`.\n" +
        "- **Login error** — the error redirect URL with the error in the **query string**: `<errorUrl>?errorCode=<code>[&errorMessage=<message>]` (`errorMessage` is present only when the identity provider returned one).",
      redirect: true,
      headers: {
        Location: {
          description:
            "Client redirect URL. On success: `<successUrl>#token=<sessionToken>` (token in the fragment). On login error: `<errorUrl>?errorCode=<code>[&errorMessage=<message>]` (params in the query string).",
          schema: { type: "string", format: "uri" },
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
  loginErrorRedirectUrl: string;
};

export const mountCallbackHandler = (
  server: FastifyInstance,
  deps: CallbackHandlerDeps,
): void => {
  mountFastifyRoute(server, {
    contract: callbackContract,
    middlewares: [extractIpMiddleware] as const,
    inputMapper: (req, context): HandleOidcCallbackInput => ({
      callback: req.query,
      ipAddress: context.ipAddress,
    }),
    outputMapper: (result) => {
      if (result.outcome === "error") {
        const errorUrl = new URL(deps.loginErrorRedirectUrl);
        errorUrl.searchParams.set("errorCode", result.errorCode);
        if (result.errorMessage !== undefined) {
          errorUrl.searchParams.set("errorMessage", result.errorMessage);
        }
        return errorUrl.href;
      } else {
        const redirectUrl = new URL(deps.loginSuccessRedirectUrl);
        redirectUrl.hash = new URLSearchParams({
          token: result.token,
        }).toString();
        return redirectUrl.href;
      }
    },
    useCase: deps.handleOidcCallbackUseCase,
  });
};
