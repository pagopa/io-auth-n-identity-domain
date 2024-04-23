import * as passport from "passport";
import bearerSessionTokenStrategy from "./auth/session-token-strategy";
import { RedisClientSelector } from "./repositories/redis";
import { attachTrackingData } from "./utils/appinsights";
import { getRequiredENVVar } from "./utils/environment";
import express from "express";
import { toExpressHandler } from "@pagopa/ts-commons/lib/express";
import { APIClient } from "./repositories/api";
import { getSessionState } from "./controllers/session";
import { httpOrHttpsApiFetch } from "./utils/fetch";
import { Express } from "express";

export const newApp = async (): Promise<Express> => {
  // Create the Session Storage service
  const REDIS_CLIENT_SELECTOR = await RedisClientSelector(true)(
    getRequiredENVVar("REDIS_URL"),
    // eslint-disable-next-line turbo/no-undeclared-env-vars
    process.env.REDIS_PASSWORD,
    // eslint-disable-next-line turbo/no-undeclared-env-vars
    process.env.REDIS_PORT,
  );
  const API_CLIENT = APIClient(
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

  const authMiddlewares = {
    bearerSession: passport.authenticate("bearer.session", {
      session: false,
    }),
  };

  const API_BASE_PATH = getRequiredENVVar("API_BASE_PATH");

  app.get(
    `${API_BASE_PATH}/session`,
    authMiddlewares.bearerSession,
    toExpressHandler(getSessionState(REDIS_CLIENT_SELECTOR, API_CLIENT)),
  );
  return app;
};
