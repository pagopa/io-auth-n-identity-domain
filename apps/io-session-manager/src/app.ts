/* eslint-disable turbo/no-undeclared-env-vars */
import * as appInsights from "applicationinsights";
import passport from "passport";
import express from "express";
import { ap } from "fp-ts/lib/Identity";
import { pipe } from "fp-ts/lib/function";
import helmet from "helmet";
import * as bodyParser from "body-parser";
import { withSpid } from "@pagopa/io-spid-commons";
import * as TE from "fp-ts/TaskEither";
import { ValidUrl } from "@pagopa/ts-commons/lib/url";
import { ResponsePermanentRedirect } from "@pagopa/ts-commons/lib/responses";
import * as E from "fp-ts/Either";
import * as O from "fp-ts/Option";
import { CIDR, FiscalCode } from "@pagopa/ts-commons/lib/strings";
import { pick } from "@pagopa/ts-commons/lib/types";
import cookieparser from "cookie-parser";
import { ServiceBusClient } from "@azure/service-bus";
import { DefaultAzureCredential } from "@azure/identity";
import { AuthSessionsTopicRepository } from "@pagopa/io-auth-n-identity-commons/repositories/auth-sessions-topic-repository";
import bearerSessionTokenStrategy from "./auth/session-token-strategy";
import bearerFIMSTokenStrategy from "./auth/bearer-FIMS-token-strategy";
import { RedisRepo, FnAppRepo, FnLollipopRepo } from "./repositories";
import { attachTrackingData } from "./utils/appinsights";
import { getRequiredENVVar } from "./utils/environment";
import {
  AuthenticationController,
  SessionController,
  FastLoginController,
  HealthCheckController,
  SpidLogsController,
  SSOController,
  ZendeskController,
  BPDController,
  PagoPAController,
} from "./controllers";
import {
  applyErrorMiddleware,
  checkIdpConfiguration,
  toExpressHandler,
  toExpressMiddleware,
  setupMetadataRefresher,
  AppWithRefresherTimer,
} from "./utils/express";
import { withUserFromRequest } from "./utils/user";
import { AdditionalLoginProps, LoginTypeEnum } from "./types/fast-login";
import { TimeTracer } from "./utils/timer";
import { RedisClientMode, RedisClientSelectorType } from "./types/redis";
import {
  BPDConfig,
  FastLoginConfig,
  FimsConfig,
  LoginConfig,
  PagoPAConfig,
  SpidConfig,
  ZendeskConfig,
  isDevEnv,
  AppInsightsConfig,
  ServiceBusConfig,
  PROXY_BASE_PATH,
  toProxySSOBasePath,
} from "./config";
import { acsRequestMapper, getLoginTypeOnElegible } from "./utils/fast-login";
import { LollipopService, RedisSessionStorageService } from "./services";
import { lollipopLoginMiddleware } from "./utils/lollipop";
import { checkIP, withIPFromRequest } from "./utils/network";
import { expressLollipopMiddleware } from "./utils/lollipop";
import { bearerZendeskTokenStrategy } from "./auth/bearer-zendesk-token-strategy";
import { bearerBPDTokenStrategy } from "./auth/bearer-BPD-token-strategy";
import { initAPIClientsDependencies } from "./utils/api-clients";
import {
  ALLOWED_CIE_TEST_FISCAL_CODES,
  getClientErrorRedirectionUrl,
  getClientProfileRedirectionUrl,
} from "./config/spid";
import {
  isUserElegibleForIoLoginUrlScheme,
  standardTokenDurationSecs,
} from "./config/login";
import { initStorageDependencies } from "./utils/storages";
import { omit } from "./utils/types";
import { isUserElegibleForFastLogin } from "./config/fast-login";
import { bearerWalletTokenStrategy } from "./auth/bearer-wallet-token-strategy";
import { AcsDependencies } from "./controllers/authentication";
import { localStrategy } from "./auth/local-strategy";
import { isUserElegibleForValidationCookie } from "./config/validation-cookie";

export interface IAppFactoryParameters {
  readonly appInsightsClient?: appInsights.TelemetryClient;
}

export const newApp: (
  params: IAppFactoryParameters,
  // eslint-disable-next-line max-lines-per-function
) => Promise<AppWithRefresherTimer & RedisRepo.RedisRepositoryDeps> = async ({
  appInsightsClient,
}) => {
  // Create the Session Storage service
  const REDIS_CLIENT_SELECTOR = await RedisRepo.RedisClientSelector(
    !isDevEnv,
    AppInsightsConfig.APPINSIGHTS_REDIS_TRACE_ENABLED,
    appInsightsClient,
  )(
    getRequiredENVVar("REDIS_URL"),
    process.env.REDIS_PASSWORD,
    process.env.REDIS_PORT,
  );
  // Create the API client for the Azure Functions App
  const APIClients = initAPIClientsDependencies();
  const storageDependencies = initStorageDependencies();

  const serviceBusClient = setupServiceBus(
    ServiceBusConfig.SERVICE_BUS_NAMESPACE,
    ServiceBusConfig.DEV_SERVICE_BUS_CONNECTION_STRING,
  );

  const authSessionsTopicServiceBusSender = serviceBusClient.createSender(
    ServiceBusConfig.AUTH_SESSIONS_TOPIC_NAME,
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

  app.use(cookieparser());

  //
  // Ensure that checkIP middleware has the client IP
  //
  if (!isDevEnv) {
    // Trust proxy uses proxy X-Forwarded-Proto for ssl.
    app.enable("trust proxy");
  }

  const authMiddlewares = setupAuthenticationMiddlewares();

  // Setup paths

  const acsDependencies: AcsDependencies = {
    redisClientSelector: REDIS_CLIENT_SELECTOR,
    appInsightsTelemetryClient: appInsightsClient,
    getClientErrorRedirectionUrl,
    getClientProfileRedirectionUrl,
    isUserElegibleForIoLoginUrlScheme,
    isTestUser: LoginConfig.isTestUser,
    allowedCieTestFiscalCodes: ALLOWED_CIE_TEST_FISCAL_CODES,
    standardTokenDurationSecs,
    lvTokenDurationSecs: FastLoginConfig.lvTokenDurationSecs,
    lvLongSessionDurationSecs: FastLoginConfig.lvLongSessionDurationSecs,
    ...pick(["fnAppAPIClient", "fnLollipopAPIClient"], APIClients),
    ...omit(["spidLogQueueClient"], storageDependencies),
    isUserElegibleForFastLogin,
    isUserElegibleForValidationCookie,
    AuthSessionsTopicRepository,
    authSessionsTopicSender: authSessionsTopicServiceBusSender,
  };

  setupExternalEndpoints(
    app,
    PROXY_BASE_PATH,
    APIClients,
    storageDependencies,
    LoginConfig,
    FastLoginConfig,
    authMiddlewares,
    REDIS_CLIENT_SELECTOR,
    acsDependencies,
    appInsightsClient,
  );

  setupBPDEndpoints(
    app,
    toProxySSOBasePath("bpd"),
    BPDConfig,
    APIClients.fnAppAPIClient,
    authMiddlewares,
  );

  setupPagoPAEndpoints(
    app,
    toProxySSOBasePath("pagopa"),
    PagoPAConfig,
    APIClients.fnAppAPIClient,
    REDIS_CLIENT_SELECTOR,
    authMiddlewares,
  );

  setupZendeskEndpoints(
    app,
    toProxySSOBasePath("zendesk"),
    ZendeskConfig,
    APIClients.fnAppAPIClient,
    authMiddlewares,
  );

  setupFIMSEndpoints(
    app,
    toProxySSOBasePath("fims"),
    FimsConfig.ALLOW_FIMS_IP_SOURCE_RANGE,
    authMiddlewares,
    REDIS_CLIENT_SELECTOR,
    APIClients.fnAppAPIClient,
    APIClients.fnLollipopAPIClient,
    appInsightsClient,
  );

  const TIMER = TimeTracer();

  const withSpidApp = await pipe(
    TE.tryCatch(
      () =>
        withSpid({
          acs: AuthenticationController.acs(acsDependencies),
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
            spidLogQueueClient: storageDependencies.spidLogQueueClient,
            getLoginType: (fiscalCode: FiscalCode, loginType?: LoginTypeEnum) =>
              getLoginTypeOnElegible(
                loginType,
                FastLoginConfig.isUserElegibleForFastLogin(fiscalCode),
              ),
          }),
          lollipopMiddleware: toExpressMiddleware(
            lollipopLoginMiddleware(
              APIClients.fnLollipopAPIClient,
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
    TE.map((appAndRefresher) => ({
      ...appAndRefresher,
      spidConfigTime: TIMER.getElapsedMilliseconds(),
    })),
    TE.chain(setupMetadataRefresher(appInsightsClient)),
    TE.chainFirst(({ app }) => checkIdpConfiguration(app)),
    TE.chainFirstTaskK(({ app }) => applyErrorMiddleware(app)),
    TE.map((data) => ({ ...data, redisClientSelector: REDIS_CLIENT_SELECTOR })),
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

  // Add the strategy to authenticate BPD clients.
  passport.use("bearer.bpd", bearerBPDTokenStrategy(REDIS_CLIENT_SELECTOR));

  // Add the strategy to authenticate proxy clients.
  passport.use(
    "bearer.wallet",
    bearerWalletTokenStrategy(REDIS_CLIENT_SELECTOR),
  );
};

/**
 * Setup FIMS Endpoint
 */
function setupFIMSEndpoints(
  app: express.Application,
  FIMS_BASE_PATH: string,
  ALLOW_FIMS_IP_SOURCE_RANGE: ReadonlyArray<CIDR>,
  authMiddlewares: {
    bearerSession: express.RequestHandler;
    bearerFIMS: express.RequestHandler;
  },
  REDIS_CLIENT_SELECTOR: RedisClientSelectorType,
  API_CLIENT: FnAppRepo.FnAppAPIRepositoryDeps["fnAppAPIClient"],
  LOLLIPOP_CLIENT: FnLollipopRepo.LollipopApiClient,
  appInsightsClient?: appInsights.TelemetryClient,
) {
  app.get(
    `${FIMS_BASE_PATH}/user`,
    checkIP(ALLOW_FIMS_IP_SOURCE_RANGE),
    authMiddlewares.bearerFIMS,
    pipe(
      toExpressHandler({
        fnAppAPIClient: API_CLIENT,
      }),
      ap(withUserFromRequest(SSOController.getUserForFIMS)),
    ),
  );

  app.post(
    `${FIMS_BASE_PATH}/lollipop-user`,
    checkIP(ALLOW_FIMS_IP_SOURCE_RANGE),
    authMiddlewares.bearerFIMS,
    pipe(
      toExpressHandler({
        // Clients
        redisClientSelector: REDIS_CLIENT_SELECTOR,
        fnAppAPIClient: API_CLIENT,
        fnLollipopAPIClient: LOLLIPOP_CLIENT,
        // Services
        lollipopService: LollipopService,
        redisSessionStorageService: RedisSessionStorageService,
        appInsightsTelemetryClient: appInsightsClient,
      }),
      ap(withUserFromRequest(SSOController.getLollipopUserForFIMS)),
    ),
  );
}

function setupExternalEndpoints(
  app: express.Application,
  basePath: string,
  APIClients: ReturnType<typeof initAPIClientsDependencies>,
  storageDependencies: ReturnType<typeof initStorageDependencies>,
  loginConfig: typeof LoginConfig,
  fastLoginConfig: typeof FastLoginConfig,
  authMiddlewares: {
    local: express.RequestHandler;
    bearerSession: express.RequestHandler;
  },
  redisClientSelector: RedisClientSelectorType,
  acsDependencies: AcsDependencies,
  appInsightsClient?: appInsights.TelemetryClient,
) {
  pipe(
    loginConfig.TEST_LOGIN_PASSWORD,
    E.map((testLoginPassword) => {
      passport.use(
        "local",
        localStrategy(
          loginConfig.isTestUser,
          testLoginPassword,
          APIClients.fnLollipopAPIClient,
          appInsightsClient,
        ),
      );

      app.post(`${basePath}/test-login`, authMiddlewares.local, (req, res) =>
        pipe(
          toExpressHandler({
            ...acsDependencies,
          })(
            AuthenticationController.acsTest({
              ...req.user,
              getAcsOriginalRequest: () => req,
            }),
          ),
          (handler) => handler(req, res),
        ),
      );
    }),
  );

  app.get(
    `${basePath}/healthcheck`,
    pipe(
      toExpressHandler({
        redisClientSelector,
      }),
      ap(HealthCheckController.healthcheck),
    ),
  );

  app.post(
    `${basePath}/logout`,
    authMiddlewares.bearerSession,
    pipe(
      toExpressHandler({
        // Clients
        redisClientSelector,
        lollipopApiClient: APIClients.fnLollipopAPIClient,
        lollipopRevokeQueueClient:
          storageDependencies.lollipopRevokeQueueClient,
        // Services
        redisSessionStorageService: RedisSessionStorageService,
        lollipopService: LollipopService,

        AuthSessionsTopicRepository,
        authSessionsTopicSender: acsDependencies.authSessionsTopicSender,
      }),
      ap(withUserFromRequest(SessionController.logout)),
    ),
  );

  app.get(
    `${basePath}/session`,
    authMiddlewares.bearerSession,
    pipe(
      toExpressHandler({
        redisClientSelector,
        fnAppAPIClient: APIClients.fnAppAPIClient,
      }),
      ap(withUserFromRequest(SessionController.getSessionState)),
    ),
  );

  app.get(
    `${basePath}/user-identity`,
    authMiddlewares.bearerSession,
    pipe(
      toExpressHandler({
        redisClientSelector,
      }),
      ap(withUserFromRequest(SessionController.getUserIdentity)),
    ),
  );

  app.post(
    `${basePath}/fast-login/nonce/generate`,
    pipe(
      toExpressHandler({
        fnFastLoginAPIClient: APIClients.fnFastLoginAPIClient,
      }),
      ap(FastLoginController.generateNonceEndpoint),
    ),
  );

  app.post(
    `${basePath}/fast-login`,
    expressLollipopMiddleware(
      APIClients.fnLollipopAPIClient,
      redisClientSelector,
      appInsightsClient,
    ),
    pipe(
      toExpressHandler({
        redisClientSelector,
        fnFastLoginAPIClient: APIClients.fnFastLoginAPIClient,
        sessionTTL: fastLoginConfig.lvTokenDurationSecs,
      }),
      ap(withIPFromRequest(FastLoginController.fastLoginEndpoint)),
    ),
  );
}

function setupBPDEndpoints(
  app: express.Application,
  basePath: string,
  bpdConfig: typeof BPDConfig,
  fnAppAPIClient: FnAppRepo.FnAppAPIRepositoryDeps["fnAppAPIClient"],
  authMiddlewares: {
    bearerBPD: express.RequestHandler;
  },
) {
  app.get(
    `${basePath}/user`,
    checkIP(bpdConfig.ALLOW_BPD_IP_SOURCE_RANGE),
    authMiddlewares.bearerBPD,
    pipe(
      toExpressHandler({
        fnAppAPIClient,
      }),
      ap(withUserFromRequest(BPDController.getUserForBPD)),
    ),
  );
}

function setupPagoPAEndpoints(
  app: express.Application,
  basePath: string,
  pagopaConfig: typeof PagoPAConfig,
  fnAppAPIClient: FnAppRepo.FnAppAPIRepositoryDeps["fnAppAPIClient"],
  redisClientSelector: RedisClientSelectorType,
  authMiddlewares: {
    bearerWallet: express.RequestHandler;
  },
) {
  app.get(
    `${basePath}/user`,
    checkIP(pagopaConfig.ALLOW_PAGOPA_IP_SOURCE_RANGE),
    authMiddlewares.bearerWallet,
    pipe(
      toExpressHandler({
        enableNoticeEmailCache: pagopaConfig.ENABLE_NOTICE_EMAIL_CACHE,
        redisClientSelector,
        fnAppAPIClient,
      }),
      ap(withUserFromRequest(PagoPAController.getUser)),
    ),
  );
}

function setupZendeskEndpoints(
  app: express.Application,
  basePath: string,
  zendeskConfig: typeof ZendeskConfig,
  fnAppAPIClient: FnAppRepo.FnAppAPIRepositoryDeps["fnAppAPIClient"],
  authMiddlewares: {
    bearerZendesk: express.RequestHandler;
  },
) {
  app.post(
    `${basePath}/jwt`,
    checkIP(zendeskConfig.ALLOW_ZENDESK_IP_SOURCE_RANGE),
    authMiddlewares.bearerZendesk,
    pipe(
      toExpressHandler({
        fnAppAPIClient,
        jwtZendeskSupportTokenSecret:
          zendeskConfig.JWT_ZENDESK_SUPPORT_TOKEN_SECRET,
        jwtZendeskSupportTokenExpiration:
          zendeskConfig.JWT_ZENDESK_SUPPORT_TOKEN_EXPIRATION,
        jwtZendeskSupportTokenIssuer:
          zendeskConfig.JWT_ZENDESK_SUPPORT_TOKEN_ISSUER,
      }),
      ap(withUserFromRequest(ZendeskController.getZendeskSupportToken)),
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
    bearerBPD: passport.authenticate("bearer.bpd", {
      session: false,
    }),
    bearerWallet: passport.authenticate("bearer.wallet", {
      session: false,
    }),
    local: passport.authenticate("local", {
      session: false,
    }),
  };
}

function setupServiceBus(
  namespace: string,
  devConnectionString: O.Option<string>,
) {
  return O.fold(
    () => new ServiceBusClient(namespace, new DefaultAzureCredential()),
    (connectionString: string) => new ServiceBusClient(connectionString),
  )(devConnectionString);
}
