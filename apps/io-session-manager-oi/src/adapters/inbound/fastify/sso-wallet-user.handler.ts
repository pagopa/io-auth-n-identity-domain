import { defineRoute, ProblemJson } from "@pagopa/hexagonal-core";
import { mountFastifyRoute } from "@pagopa/hexagonal-fastify";
import type { AnyRouteContract } from "@pagopa/hexagonal-openapi";
import { FastifyInstance } from "fastify";

import { GetUserForWalletUseCase } from "../../../application/use-cases/get-user-for-wallet.use-case.js";
import { AuthenticationMiddleware } from "../../../middlewares/authentication/index.js";
import { SSO_WALLET_BASE_PATH } from "../base-path.js";
import { SsoWalletUserOutputDTO } from "../dtos/sso-wallet-user.dto.js";

import { createCheckIpHook } from "./hooks/check-ip.hook.js";

const ssoWalletUserContract = defineRoute({
  method: "get",
  operationId: "getUserForWallet",
  path: `${SSO_WALLET_BASE_PATH}/user`,
  request: {},
  summary: "Return the Wallet user for a session token",
  description:
    "Returns the Wallet user identified by the token carried in the `Authorization: Bearer` header. Requests whose source IP is not within the configured allowlist are rejected with `401 Unauthorized`.",
  tags: ["sso"],
  response: {
    200: {
      description: "The Wallet user for the provided session token",
      schema: SsoWalletUserOutputDTO,
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

export type SsoWalletUserHandlerDeps = {
  allowedIpSourceRange: ReadonlyArray<string>;
  middlewares: readonly [AuthenticationMiddleware<"wallet">];
  useCase: GetUserForWalletUseCase;
};

export const mountSsoWalletUserHandler = (
  server: FastifyInstance,
  deps: SsoWalletUserHandlerDeps,
): void => {
  // Fastify plugin scope: the check-ip preHandler stays confined to this route.
  server.register((scope, _opts, done) => {
    scope.addHook("preHandler", createCheckIpHook(deps.allowedIpSourceRange));
    mountFastifyRoute(scope, {
      contract: ssoWalletUserContract,
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
// leak the branded `unique symbol` of `SsoWalletUserOutputDTO` (TS2527).
export const ssoWalletUserRoute: AnyRouteContract = ssoWalletUserContract;
