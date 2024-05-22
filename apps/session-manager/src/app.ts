/* eslint-disable turbo/no-undeclared-env-vars */
import { QueueClient } from "@azure/storage-queue";
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
import * as E from "fp-ts/Either";
import { FiscalCode } from "@pagopa/ts-commons/lib/strings";
import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";
import bearerSessionTokenStrategy from "./auth/session-token-strategy";
import bearerFIMSTokenStrategy from "./auth/bearer-FIMS-token-strategy";
import { RedisRepo, FnAppRepo, FnFastLoginRepo } from "./repositories";
import { attachTrackingData } from "./utils/appinsights";
import { getENVVarWithDefault, getRequiredENVVar } from "./utils/environment";
import {
  SessionController,
  FastLoginController,
  SpidLogsController,
  SSOController,
  ZendeskController,
} from "./controllers";
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
import { RedisClientMode, RedisClientSelectorType } from "./types/redis";
import { SpidLogConfig, SpidConfig, ZendeskConfig } from "./config";
import { acsRequestMapper, getLoginTypeOnElegible } from "./utils/fast-login";
import { LollipopService, RedisSessionStorageService } from "./services";
import {
  FF_LOLLIPOP_ENABLED,
  LOLLIPOP_API_BASE_PATH,
  LOLLIPOP_API_KEY,
  LOLLIPOP_API_URL,
} from "./config/lollipop";
import { isUserElegibleForFastLogin } from "./config/fast-login";
import { lollipopLoginMiddleware } from "./utils/lollipop";
import { checkIP, withIPFromRequest } from "./utils/network";
import { expressLollipopMiddleware } from "./utils/lollipop";
import { bearerZendeskTokenStrategy } from "./auth/bearer-zendesk-token-strategy";
import { ALLOW_ZENDESK_IP_SOURCE_RANGE } from "./config/zendesk";

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

  setupAuthentication(REDIS_CLIENT_SELECTOR);

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

  //
  // Ensure that checkIP middleware has the client IP
  //
  if (!isDevEnv) {
    // Trust proxy uses proxy X-Forwarded-Proto for ssl.
    app.enable("trust proxy");
  }

  const authMiddlewares = setupAuthenticationMiddlewares();

  const API_BASE_PATH = getRequiredENVVar("API_BASE_PATH");
  const FIMS_BASE_PATH = getRequiredENVVar("FIMS_BASE_PATH");
  const ZENDESK_BASE_PATH = getRequiredENVVar("ZENDESK_BASE_PATH");

  // Setup paths

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
      ap(FastLoginController.generateNonceEndpoint),
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
    expressLollipopMiddleware(LOLLIPOP_CLIENT, REDIS_CLIENT_SELECTOR),
    pipe(
      toExpressHandler({
        redisClientSelector: REDIS_CLIENT_SELECTOR,
        fnFastLoginAPIClient: FAST_LOGIN_CLIENT,
        sessionTTL,
      }),
      ap(withIPFromRequest(FastLoginController.fastLoginEndpoint)),
    ),
  );

  setupFIMSEndpoints(
    app,
    FIMS_BASE_PATH,
    authMiddlewares,
    REDIS_CLIENT_SELECTOR,
    API_CLIENT,
    LOLLIPOP_CLIENT,
  );

  app.post(
    `${ZENDESK_BASE_PATH}/jwt`,
    checkIP(ALLOW_ZENDESK_IP_SOURCE_RANGE),
    authMiddlewares.bearerZendesk,
    pipe(
      toExpressHandler({
        fnAppAPIClient: API_CLIENT,
        redisClientSelector: REDIS_CLIENT_SELECTOR,
        jwtZendeskSupportTokenSecret:
          ZendeskConfig.JWT_ZENDESK_SUPPORT_TOKEN_SECRET,
        jwtZendeskSupportTokenExpiration:
          ZendeskConfig.JWT_ZENDESK_SUPPORT_TOKEN_EXPIRATION,
        jwtZendeskSupportTokenIssuer:
          ZendeskConfig.JWT_ZENDESK_SUPPORT_TOKEN_ISSUER,
      }),
      ap(withUserFromRequest(ZendeskController.getZendeskSupportToken)),
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

// -------------------------------------
// Private methods
// -------------------------------------

/**
 * Setup passport authentication strategies
 */
const setupAuthentication = (
  REDIS_CLIENT_SELECTOR: RedisClientSelectorType,
) => {
  passport.use(
    "bearer.session",
    bearerSessionTokenStrategy(REDIS_CLIENT_SELECTOR)(attachTrackingData),
  );

  // Add the strategy to authenticate FIMS clients.
  passport.use("bearer.fims", bearerFIMSTokenStrategy(REDIS_CLIENT_SELECTOR));

  // Add the strategy to authenticate Zendesk clients.
  passport.use(
    "bearer.zendesk",
    bearerZendeskTokenStrategy(REDIS_CLIENT_SELECTOR),
  );
};

// TODO [#IOPID-1858]: Add IP Filtering
/**
 * Setup FIMS Endpoint
 */
function setupFIMSEndpoints(
  app: express.Application,
  FIMS_BASE_PATH: string,
  authMiddlewares: {
    bearerSession: express.RequestHandler;
    bearerFIMS: express.RequestHandler;
  },
  REDIS_CLIENT_SELECTOR: RedisClientSelectorType,
  API_CLIENT: FnAppRepo.FnAppAPIRepositoryDeps["fnAppAPIClient"],
  LOLLIPOP_CLIENT: FnFastLoginRepo.LollipopApiClient,
) {
  app.get(
    `${FIMS_BASE_PATH}/user`,
    authMiddlewares.bearerFIMS,
    pipe(
      toExpressHandler({
        redisClientSelector: REDIS_CLIENT_SELECTOR,
        fnAppAPIClient: API_CLIENT,
      }),
      ap(withUserFromRequest(SSOController.getUserForFIMS)),
    ),
  );

  app.post(
    `${FIMS_BASE_PATH}/lollipop-user`,
    authMiddlewares.bearerFIMS,
    pipe(
      toExpressHandler({
        // Clients
        redisClientSelector: REDIS_CLIENT_SELECTOR,
        fnAppAPIClient: API_CLIENT,
        lollipopApiClient: LOLLIPOP_CLIENT,
        // Services
        lollipopService: LollipopService,
        redisSessionStorageService: RedisSessionStorageService,
      }),
      ap(withUserFromRequest(SSOController.getLollipopUserForFIMS)),
    ),
  );
}

/**
 * Setup middlewares for user authentication
 */
function setupAuthenticationMiddlewares() {
  return {
    bearerSession: passport.authenticate("bearer.session", {
      session: false,
    }),
    bearerFIMS: passport.authenticate("bearer.fims", {
      session: false,
    }),
    bearerZendesk: passport.authenticate("bearer.zendesk", {
      session: false,
    }),
  };
}
