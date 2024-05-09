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
import { FiscalCode } from "@pagopa/ts-commons/lib/strings";
import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";
import bearerSessionTokenStrategy from "./auth/session-token-strategy";
import { httpOrHttpsApiFetch } from "./utils/fetch";
import {
  applyErrorMiddleware,
  checkIdpConfiguration,
  toExpressHandler,
  toExpressMiddleware,
  setupMetadataRefresherAndGS,
} from "./utils/express";
import { withUserFromRequest } from "./utils/user";
import { getFnFastLoginAPIClient } from "./repositories/fast-login-api";
import { getLollipopApiClient } from "./repositories/lollipop-api";
import { AdditionalLoginProps, LoginTypeEnum } from "./types/fast-login";
import { TimeTracer } from "./utils/timer";
import { RedisClientMode } from "./types/redis";
import { SpidLogConfig, SpidConfig } from "./config";
import { acsRequestMapper, getLoginTypeOnElegible } from "./utils/fast-login";
import {
  FF_LOLLIPOP_ENABLED,
  LOLLIPOP_API_BASE_PATH,
  LOLLIPOP_API_KEY,
  LOLLIPOP_API_URL,
} from "./config/lollipop";
import { isUserElegibleForFastLogin } from "./config/fast-login";
import { lollipopLoginMiddleware } from "./utils/lollipop";
import {
  fastLoginEndpoint,
  generateNonceEndpoint,
} from "./controllers/fast-login";
import { withIPFromRequest } from "./utils/network";

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
    LOLLIPOP_API_KEY,
    LOLLIPOP_API_URL,
    LOLLIPOP_API_BASE_PATH,
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

  app.get("/healthcheck", (_req: express.Request, res: express.Response) => {
    res.send("ok");
  });

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

  const DEFAULT_LV_TOKEN_DURATION_IN_SECONDS = (60 * 15) as NonNegativeInteger;
  const sessionTTL = getENVVarWithDefault(
    "LV_TOKEN_DURATION_IN_SECONDS",
    NonNegativeInteger,
    DEFAULT_LV_TOKEN_DURATION_IN_SECONDS,
  );

  app.post(
    `${API_BASE_PATH}/fast-login`,
    pipe(
      toExpressHandler({
        redisClientSelector: REDIS_CLIENT_SELECTOR,
        fnFastLoginAPIClient: FAST_LOGIN_CLIENT,
        sessionTTL,
        // TODO: lollipopMiddleware
        locals: undefined,
      }),
      ap(withIPFromRequest(fastLoginEndpoint)),
    ),
  );

  const TIMER = TimeTracer();

  const withSpidApp = await pipe(
    TE.tryCatch(
      () =>
        withSpid({
          // TODO: Not implemented acs
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
            extraLoginRequestParamConfig: {
              codec: AdditionalLoginProps,
              requestMapper: acsRequestMapper,
            },
          },
          doneCb: SpidLogsController.makeSpidLogCallback({
            spidLogQueueClient: SPID_LOG_QUEUE_CLIENT,
            getLoginType: (fiscalCode: FiscalCode, loginType?: LoginTypeEnum) =>
              getLoginTypeOnElegible(
                loginType,
                isUserElegibleForFastLogin(fiscalCode),
                FF_LOLLIPOP_ENABLED,
              ),
          }),
          lollipopMiddleware: toExpressMiddleware(
            lollipopLoginMiddleware(
              FF_LOLLIPOP_ENABLED,
              LOLLIPOP_CLIENT,
              appInsightsClient,
            ),
          ),
          // TODO: Not implemented logout
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
    TE.chain(setupMetadataRefresherAndGS(REDIS_CLIENT_SELECTOR)),
    TE.chainFirst(checkIdpConfiguration),
    TE.chainFirstTaskK(applyErrorMiddleware),
  )();
  return E.getOrElseW(() => {
    app.emit("server:stop");
    throw new Error("Error configuring the application");
  })(withSpidApp);
};
