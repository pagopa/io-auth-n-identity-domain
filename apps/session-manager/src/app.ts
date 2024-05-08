/* eslint-disable turbo/no-undeclared-env-vars */
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
import * as bodyParser from "body-parser";
import { withSpid } from "@pagopa/io-spid-commons";
import * as TE from "fp-ts/TaskEither";
import { ValidUrl } from "@pagopa/ts-commons/lib/url";
import {
  ResponseErrorInternal,
  ResponsePermanentRedirect,
} from "@pagopa/ts-commons/lib/responses";
import { QueueClient } from "@azure/storage-queue";
import * as E from "fp-ts/Either";
import bearerSessionTokenStrategy from "./auth/session-token-strategy";
import { RedisRepo, FnAppRepo } from "./repositories";
import { attachTrackingData } from "./utils/appinsights";
import { getRequiredENVVar } from "./utils/environment";
import { SessionController, SpidLogsController } from "./controllers";
import { httpOrHttpsApiFetch } from "./utils/fetch";
import { toExpressHandler } from "./utils/express";
import { withUserFromRequest } from "./utils/user";
import { getFnFastLoginAPIClient } from "./repositories/fast-login-api";
import { generateNonceEndpoint } from "./controllers/fast-login";
import { getLollipopApiClient } from "./repositories/lollipop-api";
import { LoginTypeEnum } from "./types/fast-login";
import { TimeTracer } from "./utils/timer";
import { RedisClientMode } from "./types/redis";
import { SpidLogConfig, SpidConfig } from "./config";

export interface IAppFactoryParameters {
  // TODO: Add the right AppInsigns type
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly appInsightsClient?: any;
}

export const newApp: (
  params: IAppFactoryParameters,
) => Promise<Express> = async ({ appInsightsClient }) => {
  const isDevEnv =
    getNodeEnvironmentFromProcessEnv(process.env) ===
    NodeEnvironmentEnum.DEVELOPMENT;

  // Create the Session Storage service
  const REDIS_CLIENT_SELECTOR = await RedisRepo.RedisClientSelector(!isDevEnv)(
    getRequiredENVVar("REDIS_URL"),
    process.env.REDIS_PASSWORD,
    process.env.REDIS_PORT,
  );
  // Create the API client for the Azure Functions App
  const API_CLIENT = FnAppRepo.FnAppAPIClient(
    getRequiredENVVar("API_URL"),
    getRequiredENVVar("API_KEY"),
    httpOrHttpsApiFetch,
  );
  const FAST_LOGIN_CLIENT = getFnFastLoginAPIClient(
    getRequiredENVVar("FAST_LOGIN_API_KEY"),
    getRequiredENVVar("FAST_LOGIN_API_URL"),
  );
  const LOLLIPOP_CLIENT = getLollipopApiClient(
    getRequiredENVVar("LOLLIPOP_API_KEY"),
    getRequiredENVVar("LOLLIPOP_API_URL"),
    getRequiredENVVar("LOLLIPOP_API_BASE_PATH"),
    httpOrHttpsApiFetch,
  );

  // Create the Client to the Spid Log Queue
  const SPID_LOG_QUEUE_CLIENT = new QueueClient(
    SpidLogConfig.SPID_LOG_STORAGE_CONNECTION_STRING,
    SpidLogConfig.SPID_LOG_QUEUE_NAME,
  );

  passport.use(
    "bearer.session",
    bearerSessionTokenStrategy(REDIS_CLIENT_SELECTOR)(attachTrackingData),
  );

  const app = express();

  //
  // Setup parsers
  //

  // Parse the incoming request body. This is needed by Passport spid strategy.
  app.use(
    bodyParser.json({
      verify: (_req, res: express.Response, buf, _encoding: BufferEncoding) => {
        // eslint-disable-next-line functional/immutable-data
        res.locals.body = buf;
      },
    }),
  );

  // Parse an urlencoded body.
  app.use(bodyParser.urlencoded({ extended: true }));

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
      toExpressHandler({
        redisClientSelector: REDIS_CLIENT_SELECTOR,
        fnAppAPIClient: API_CLIENT,
      }),
      ap(withUserFromRequest(SessionController.getSessionState)),
    ),
  );

  app.post(
    `${API_BASE_PATH}/fast-login/nonce/generate`,
    pipe(
      toExpressHandler({ fnFastLoginAPIClient: FAST_LOGIN_CLIENT }),
      ap(generateNonceEndpoint),
    ),
  );

  const TIMER = TimeTracer();

  const withSpidApp = await pipe(
    TE.tryCatch(
      () =>
        withSpid({
          // TODO: Not implemented
          acs: () =>
            Promise.resolve(ResponseErrorInternal("not implemented yet")),
          app,
          appConfig: {
            ...SpidConfig.appConfig,
            eventTraker: (event) => {
              appInsightsClient?.trackEvent({
                name: event.name,
                properties: {
                  type: event.type,
                  ...event.data,
                },
              });
            },
          },
          doneCb: SpidLogsController.makeSpidLogCallback({
            spidLogQueueClient: SPID_LOG_QUEUE_CLIENT,
            // TODO: Not implemented
            getLoginType: () => LoginTypeEnum.LEGACY,
          }),
          // TODO: Not implemented
          logout: () =>
            Promise.resolve(
              ResponsePermanentRedirect({ href: "/" } as ValidUrl),
            ),
          redisClient: REDIS_CLIENT_SELECTOR.selectOne(RedisClientMode.FAST),
          samlConfig: SpidConfig.samlConfig,
          serviceProviderConfig: SpidConfig.serviceProviderConfig,
        })(),
      (err) => new Error(`Unexpected error initizing Spid Login: [${err}]`),
    ),
    TE.map((withSpidApp) => ({
      ...withSpidApp,
      spidConfigTime: TIMER.getElapsedMilliseconds(),
    })),
  )();
  return E.getOrElseW(() => {
    throw new Error("Error configuring the application");
  })(withSpidApp).app;
};
