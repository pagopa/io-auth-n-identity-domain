import passport from "passport";
import express from "express";
import { Express } from "express";
import { ap } from "fp-ts/lib/Identity";
import { pipe } from "fp-ts/lib/function";
import helmet from "helmet";
import {
  NodeEnvironmentEnum,
  getNodeEnvironmentFromProcessEnv,
} from "@pagopa/ts-commons/lib/environment";
import bearerSessionTokenStrategy from "./auth/session-token-strategy";
import { RedisClientSelector } from "./repositories/redis";
import { attachTrackingData } from "./utils/appinsights";
import { getRequiredENVVar } from "./utils/environment";
import { FnAppAPIClient } from "./repositories/api";
import { getSessionState } from "./controllers/session";
import { httpOrHttpsApiFetch } from "./utils/fetch";
import { toExpressHandlerRTE } from "./utils/express";
import { withUserFromRequestRTE } from "./utils/user";

export const newApp = async (): Promise<Express> => {
  const isDevEnv =
    getNodeEnvironmentFromProcessEnv(process.env) ===
    NodeEnvironmentEnum.DEVELOPMENT;

  // Create the Session Storage service
  const REDIS_CLIENT_SELECTOR = await RedisClientSelector(!isDevEnv)(
    getRequiredENVVar("REDIS_URL"),
    // eslint-disable-next-line turbo/no-undeclared-env-vars
    process.env.REDIS_PASSWORD,
    // eslint-disable-next-line turbo/no-undeclared-env-vars
    process.env.REDIS_PORT,
  );
  const API_CLIENT = FnAppAPIClient(
    getRequiredENVVar("API_URL"),
    getRequiredENVVar("API_KEY"),
    httpOrHttpsApiFetch,
  );

  passport.use(
    "bearer.session",
    bearerSessionTokenStrategy(REDIS_CLIENT_SELECTOR)(attachTrackingData),
  );

  const app = express();

  //
  // Initializes Passport for incoming requests.
  //

  app.use(passport.initialize());

  app.use(helmet());

  const authMiddlewares = {
    bearerSession: passport.authenticate("bearer.session", {
      session: false,
    }),
  };

  const API_BASE_PATH = getRequiredENVVar("API_BASE_PATH");

  app.get(
    `${API_BASE_PATH}/session`,
    authMiddlewares.bearerSession,
    pipe(
      toExpressHandlerRTE({
        redisClientSelector: REDIS_CLIENT_SELECTOR,
        fnAppAPIClient: API_CLIENT,
      }),
      ap(withUserFromRequestRTE(getSessionState)),
    ),
  );

  return app;
};
