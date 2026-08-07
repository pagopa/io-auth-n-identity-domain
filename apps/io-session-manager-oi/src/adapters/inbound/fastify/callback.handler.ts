import { defineRoute, ProblemJson } from "@pagopa/hexagonal-core";
import { mountFastifyRoute } from "@pagopa/hexagonal-fastify";
import { IPStringSchema } from "@pagopa/io-auth-n-identity-domain";
import { FastifyInstance } from "fastify";

import {
  makeActivateUserSessionUseCase,
  type NewSessionToken,
} from "../../../application/use-cases/activate-user-session.use-case.js";
import { type AusiliarDataPort } from "../../../domain/ports/outbound/ausiliar-data.port.js";
import { type OidcPort } from "../../../domain/ports/outbound/oidc.port.js";
import { CallbackInputDTO } from "../dtos/callback.dto.js";
import { makeExchangeCodeMiddleware } from "./middlewares/exchange-code.middleware.js";
import { makeRetrieveAusiliarDataMiddleware } from "./middlewares/retrieve-ausiliar-data.middleware.js";

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
  ausiliarDataPort: AusiliarDataPort;
  oidcExchangePort: OidcPort;
  activateUserSessionUseCase: ReturnType<typeof makeActivateUserSessionUseCase>;
  loginSuccessRedirectUrl: string;
};

export const mountCallbackHandler = (
  server: FastifyInstance,
  deps: CallbackHandlerDeps,
): void => {
  const middlewares = [
    makeRetrieveAusiliarDataMiddleware(deps.ausiliarDataPort),
    makeExchangeCodeMiddleware(deps.oidcExchangePort),
  ] as const;

  mountFastifyRoute(server, {
    contract: callbackContract,
    middlewares,
    inputMapper: (req, context): NewSessionToken => {
      console.log("callback handler: context", context);

      //TODO: Migliorare
      const forwardedFor = req.headers["x-forwarded-for"];
      const clientIp = forwardedFor?.split(",")[0]?.trim();
      const ipParse = IPStringSchema.safeParse(clientIp);
      // Behind the ingress proxy the client IP always arrives via
      // `x-forwarded-for`; fall back to loopback for local requests.
      const ipAddress = ipParse.success
        ? ipParse.data
        : IPStringSchema.parse("127.0.0.1");

      return {
        fiscalCode: context.claims.fiscalNumber,
        name: context.claims.name,
        familyName: context.claims.familyName,
        dateOfBirth: context.claims.dateOfBirth,
        spidLevel: context.claims.acr,
        spidEmail: context.claims.email,
        ipAddress,
        loginType: context.ausiliarData.loginType,
        identityProvider: context.claims.iss,
      };
    },
    outputMapper: (clientSessionToken) => {
      const redirectUrl = new URL(deps.loginSuccessRedirectUrl);
      redirectUrl.hash = new URLSearchParams({
        token: clientSessionToken,
      }).toString();
      return redirectUrl.href;
    },
    useCase: deps.activateUserSessionUseCase,
  });
};
