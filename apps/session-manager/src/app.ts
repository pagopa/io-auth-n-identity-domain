/* eslint-disable turbo/no-undeclared-env-vars */
import * as appInsights from "applicationinsights";
import passport from "passport";
import express from "express";
import { Express } from "express";
import { ap } from "fp-ts/lib/Identity";
import { pipe } from "fp-ts/lib/function";
import helmet from "helmet";
import * as bodyParser from "body-parser";
import { withSpid } from "@pagopa/io-spid-commons";
import * as TE from "fp-ts/TaskEither";
import { ValidUrl } from "@pagopa/ts-commons/lib/url";
import { ResponsePermanentRedirect } from "@pagopa/ts-commons/lib/responses";
import * as E from "fp-ts/Either";
import { CIDR, FiscalCode } from "@pagopa/ts-commons/lib/strings";
import { pick } from "@pagopa/ts-commons/lib/types";
import bearerSessionTokenStrategy from "./auth/session-token-strategy";
import bearerFIMSTokenStrategy from "./auth/bearer-FIMS-token-strategy";
import { RedisRepo, FnAppRepo, FnLollipopRepo } from "./repositories";
import { attachTrackingData } from "./utils/appinsights";
import { getRequiredENVVar } from "./utils/environment";
import {
  AuthenticationController,
  SessionController,
  FastLoginController,
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
  setupMetadataRefresherAndGS,
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
  LollipopConfig,
  PagoPAConfig,
  SpidConfig,
  ZendeskConfig,
  isDevEnv,
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
  clientProfileRedirectionUrl,
} from "./config/spid";
import {
  FF_UNIQUE_EMAIL_ENFORCEMENT_ENABLED,
  isUserElegibleForIoLoginUrlScheme,
  standardTokenDurationSecs,
} from "./config/login";
import { initStorageDependencies } from "./utils/storages";
import { omit } from "./utils/types";
import { isUserElegibleForFastLogin } from "./config/fast-login";
import { bearerWalletTokenStrategy } from "./auth/bearer-wallet-token-strategy";
import { AcsDependencies } from "./controllers/authentication";
import { localStrategy } from "./auth/local-strategy";
import { FF_LOLLIPOP_ENABLED } from "./config/lollipop";
import { getCurrentBackendVersion } from "./utils/package";
import { BackendVersion } from "./generated/public/BackendVersion";

export interface IAppFactoryParameters {
  readonly appInsightsClient?: appInsights.TelemetryClient;
}

export const newApp: (
  params: IAppFactoryParameters,
  // eslint-disable-next-line max-lines-per-function
) => Promise<Express> = async ({ appInsightsClient }) => {
  // Create the Session Storage service
  const REDIS_CLIENT_SELECTOR = await RedisRepo.RedisClientSelector(
    !isDevEnv,
    appInsightsClient,
  )(
    getRequiredENVVar("REDIS_URL"),
    process.env.REDIS_PASSWORD,
    process.env.REDIS_PORT,
  );
  // Create the API client for the Azure Functions App
  const APIClients = initAPIClientsDependencies();
  const storageDependencies = initStorageDependencies();

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
  const ZENDESK_BASE_PATH = getRequiredENVVar("ZENDESK_BASE_PATH");

  // Setup paths

  app.get("/healthcheck", (_req: express.Request, res: express.Response) => {
    res.json(BackendVersion.encode({ version: getCurrentBackendVersion() }));
  });

  const acsDependencies: AcsDependencies = {
    redisClientSelector: REDIS_CLIENT_SELECTOR,
    isLollipopEnabled: FF_LOLLIPOP_ENABLED,
    appInsightsTelemetryClient: appInsightsClient,
    getClientErrorRedirectionUrl,
    getClientProfileRedirectionUrl,
    isUserElegibleForIoLoginUrlScheme,
    FF_UNIQUE_EMAIL_ENFORCEMENT_ENABLED,
    isSpidEmailPersistenceEnabled:
      LoginConfig.IS_SPID_EMAIL_PERSISTENCE_ENABLED,
    testLoginFiscalCodes: LoginConfig.TEST_LOGIN_FISCAL_CODES,
    hasUserAgeLimitEnabled: LoginConfig.FF_USER_AGE_LIMIT_ENABLED,
    allowedCieTestFiscalCodes: ALLOWED_CIE_TEST_FISCAL_CODES,
    standardTokenDurationSecs,
    lvTokenDurationSecs: FastLoginConfig.lvTokenDurationSecs,
    lvLongSessionDurationSecs: FastLoginConfig.lvLongSessionDurationSecs,
    ...pick(["fnAppAPIClient", "fnLollipopAPIClient"], APIClients),
    ...omit(["spidLogQueueClient"], storageDependencies),
    isUserElegibleForFastLogin,
  };

  pipe(
    LoginConfig.TEST_LOGIN_PASSWORD,
    E.map((testLoginPassword) => {
      passport.use(
        "local",
        localStrategy(
          LoginConfig.TEST_LOGIN_FISCAL_CODES,
          testLoginPassword,
          FF_LOLLIPOP_ENABLED,
          APIClients.fnLollipopAPIClient,
          appInsightsClient,
        ),
      );

      app.post(`/test-login`, authMiddlewares.local, (req, res) =>
        pipe(
          toExpressHandler({
            ...acsDependencies,
            clientProfileRedirectionUrl,
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
    `${API_BASE_PATH}/session`,
    authMiddlewares.bearerSession,
    pipe(
      toExpressHandler({
        redisClientSelector: REDIS_CLIENT_SELECTOR,
        fnAppAPIClient: APIClients.fnAppAPIClient,
      }),
      ap(withUserFromRequest(SessionController.getSessionState)),
    ),
  );

  app.post(
    `/logout`,
    authMiddlewares.bearerSession,
    pipe(
      toExpressHandler({
        // Clients
        redisClientSelector: REDIS_CLIENT_SELECTOR,
        lollipopApiClient: APIClients.fnLollipopAPIClient,
        lollipopRevokeQueueClient:
          storageDependencies.lollipopRevokeQueueClient,
        // Services
        redisSessionStorageService: RedisSessionStorageService,
        lollipopService: LollipopService,
      }),
      ap(withUserFromRequest(SessionController.logout)),
    ),
  );

  app.post(
    `${API_BASE_PATH}/fast-login/nonce/generate`,
    pipe(
      toExpressHandler({
        fnFastLoginAPIClient: APIClients.fnFastLoginAPIClient,
      }),
      ap(FastLoginController.generateNonceEndpoint),
    ),
  );

  app.post(
    `${API_BASE_PATH}/fast-login`,
    expressLollipopMiddleware(
      APIClients.fnLollipopAPIClient,
      REDIS_CLIENT_SELECTOR,
    ),
    pipe(
      toExpressHandler({
        redisClientSelector: REDIS_CLIENT_SELECTOR,
        fnFastLoginAPIClient: APIClients.fnFastLoginAPIClient,
        sessionTTL: FastLoginConfig.lvTokenDurationSecs,
      }),
      ap(withIPFromRequest(FastLoginController.fastLoginEndpoint)),
    ),
  );

  setupFIMSEndpoints(
    app,
    FimsConfig.FIMS_BASE_PATH,
    FimsConfig.ALLOW_FIMS_IP_SOURCE_RANGE,
    authMiddlewares,
    REDIS_CLIENT_SELECTOR,
    APIClients.fnAppAPIClient,
    APIClients.fnLollipopAPIClient,
  );

  app.post(
    `${ZENDESK_BASE_PATH}/jwt`,
    checkIP(ZendeskConfig.ALLOW_ZENDESK_IP_SOURCE_RANGE),
    authMiddlewares.bearerZendesk,
    pipe(
      toExpressHandler({
        fnAppAPIClient: APIClients.fnAppAPIClient,
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

  app.get(
    `${BPDConfig.BPD_BASE_PATH}/user`,
    checkIP(BPDConfig.ALLOW_BPD_IP_SOURCE_RANGE),
    authMiddlewares.bearerBPD,
    pipe(
      toExpressHandler(pick(["fnAppAPIClient"], APIClients)),
      ap(withUserFromRequest(BPDController.getUserForBPD)),
    ),
  );

  app.get(
    `${PagoPAConfig.PAGOPA_BASE_PATH}/user`,
    checkIP(PagoPAConfig.ALLOW_PAGOPA_IP_SOURCE_RANGE),
    authMiddlewares.bearerWallet,
    pipe(
      toExpressHandler({
        enableNoticeEmailCache: PagoPAConfig.ENABLE_NOTICE_EMAIL_CACHE,
        redisClientSelector: REDIS_CLIENT_SELECTOR,
        ...pick(["fnAppAPIClient"], APIClients),
      }),
      ap(withUserFromRequest(PagoPAController.getUser)),
    ),
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
                LollipopConfig.FF_LOLLIPOP_ENABLED,
              ),
          }),
          lollipopMiddleware: toExpressMiddleware(
            lollipopLoginMiddleware(
              LollipopConfig.FF_LOLLIPOP_ENABLED,
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
    TE.map((withSpidApp) => ({
      ...withSpidApp,
      spidConfigTime: TIMER.getElapsedMilliseconds(),
    })),
    TE.chain(
      setupMetadataRefresherAndGS(REDIS_CLIENT_SELECTOR, appInsightsClient),
    ),
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
) {
  app.get(
    `${FIMS_BASE_PATH}/user`,
    checkIP(ALLOW_FIMS_IP_SOURCE_RANGE),
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
