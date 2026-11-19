import { createPrivateKey } from "node:crypto";

import type { NonEmptyString } from "@pagopa/hexagonal-core";
import { type PackageInfo } from "@pagopa/io-package-info";
import fastify, { type FastifyInstance } from "fastify";

import { mountCallbackHandler } from "./adapters/inbound/fastify/callback.handler.js";
import { mountHealthCheckHandler } from "./adapters/inbound/fastify/health-check.handler.js";
import { JwtSessionAdapter } from "./adapters/outbound/jwt-session.js";
import { getHealthCheckUseCase } from "./application/use-cases/health-check.use-case.js";
import { makeHandleOidcCallbackUseCase } from "./application/use-cases/oidc-callback.use-case.js";
import { type Config } from "./domain/value-objects/configs/index.js";
import { withErrorResultLogging } from "./middlewares/result-logging-middleware.js";
import { getLogger } from "./telemetry-client.js";

export const createApp = async (
  config: Config,
  packageInfo: PackageInfo,
): Promise<{ server: FastifyInstance }> => {
  const server = fastify({ trustProxy: true });
  const logger = getLogger(packageInfo.name as NonEmptyString);

  const sessionAdapter = new JwtSessionAdapter(
    createPrivateKey(config.JWT_TOKEN_PRIVATE_KEY.replace(/\\n/g, "\n")),
    config.JWT_TOKEN_ISSUER,
    config.JWT_TOKEN_TTL_SECONDS,
  );

  mountHealthCheckHandler("liveness")(
    server,
    getHealthCheckUseCase(packageInfo, []),
  );

  mountHealthCheckHandler("readiness")(
    server,
    getHealthCheckUseCase(packageInfo, []),
  );

  mountCallbackHandler(server, {
    handleOidcCallbackUseCase: withErrorResultLogging(
      logger.with({ component: "callback" }),
    )(
      makeHandleOidcCallbackUseCase({
        sessionPort: sessionAdapter,
      }),
    ),
    loginSuccessRedirectUrl: config.LOGIN_SUCCESS_REDIRECT_URL,
    loginErrorRedirectUrl: config.LOGIN_ERROR_REDIRECT_URL,
  });

  return { server };
};
