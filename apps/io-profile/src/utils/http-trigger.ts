import { AzureFunction, Context } from "@azure/functions";
import createAzureFunctionHandler from "@pagopa/express-azure-functions/dist/src/createAzureFunctionsHandler";
import { UserDataProcessingModel } from "@pagopa/io-functions-commons/dist/src/models/user_data_processing";
import { secureExpressApp } from "@pagopa/io-functions-commons/dist/src/utils/express";
import { setAppContext } from "@pagopa/io-functions-commons/dist/src/utils/middlewares/context_middleware";
import express, { Express } from "express";
import { ProfileModel } from "@pagopa/io-functions-commons/dist/src/models/profile";
import { DataTableProfileEmailsRepository } from "@pagopa/io-functions-commons/dist/src/utils/unique_email_enforcement/storage";
import { ServiceModel } from "@pagopa/io-functions-commons/dist/src/models/service";
import { ServicesPreferencesModel } from "@pagopa/io-functions-commons/dist/src/models/service_preference";
import { ActivationModel } from "@pagopa/io-functions-commons/dist/src/models/activation";
import { TelemetryClient } from "applicationinsights";
import { QueueClient } from "@azure/storage-queue";
import { TableService } from "azure-storage";
import { RedisClientType } from "redis";
import * as TE from "fp-ts/lib/TaskEither";
import { AbortUserDataProcessing } from "../functions/abort-user-data-processing";
import { CreateProfile } from "../functions/create-profile";
import { IConfig } from "../config";
import { GetProfile } from "../functions/get-profile";
import { GetProfileVersions } from "../functions/get-profile-versions";
import { GetServicePreferences } from "../functions/get-service-preferences";
import { GetUserDataProcessing } from "../functions/get-user-data-processing";
import { Info } from "../functions/info";
import { NoticeLoginEmail } from "../functions/notice-login-email";
import { Ping } from "../functions/ping";
import { StartEmailValidationProcess } from "../functions/start-email-validation-process";
import { UpdateProfile } from "../functions/update-profile";
import { UpsertServicePreferences } from "../functions/upsert-service-preferences";
import { UpsertUserDataProcessing } from "../functions/upsert-user-data-processing";
import { createTracker } from "./tracking";

export type WebServerDependencies = {
  config: IConfig;
  userDataProcessingModel: UserDataProcessingModel;
  profileModel: ProfileModel;
  profileEmailReader: DataTableProfileEmailsRepository;
  serviceModel: ServiceModel;
  servicePreferencesModel: ServicesPreferencesModel;
  activationModel: ActivationModel;
  telemetryClient?: TelemetryClient;
  migrateServicePreferencesQueueClient: QueueClient;
  subscriptionFeedTableService: TableService;
  redisClientTask: TE.TaskEither<Error, RedisClientType>;
  serviceCacheTTL: number;
};

export const createWebServer = ({
  userDataProcessingModel,
  config,
  profileModel,
  profileEmailReader,
  serviceModel,
  servicePreferencesModel,
  activationModel,
  telemetryClient,
  migrateServicePreferencesQueueClient,
  subscriptionFeedTableService,
  redisClientTask,
  serviceCacheTTL,
}: WebServerDependencies): Express => {
  // configure app
  const app = express();
  secureExpressApp(app);

  // https://expressjs.com/en/guide/behind-proxies.html
  app.set("trust proxy", true);

  // ////////////////////////
  // handlers mounting    //
  // //////////////////////

  app.get("/api/v1/info", Info());
  app.get("/api/v1/ping", Ping());

  app.delete(
    "/api/v1/user-data-processing/:fiscalcode/:choice",
    AbortUserDataProcessing(userDataProcessingModel),
  );

  const profilePath = "/api/v1/profiles/:fiscalcode";
  const profileVersionsPath = "/api/v1/profiles/:fiscalcode/versions";

  app.post(
    profilePath,
    CreateProfile(profileModel, config.OPT_OUT_EMAIL_SWITCH_DATE),
  );

  app.get(
    profilePath,
    GetProfile(
      profileModel,
      config.OPT_OUT_EMAIL_SWITCH_DATE,
      profileEmailReader,
    ),
  );

  app.get(
    profileVersionsPath,
    GetProfileVersions({
      profileModel,
      optOutEmailSwitchDate: config.OPT_OUT_EMAIL_SWITCH_DATE,
      profileEmailReader,
    }),
  );

  app.put(
    profilePath,
    UpdateProfile(
      profileModel,
      migrateServicePreferencesQueueClient,
      createTracker(telemetryClient),
      profileEmailReader,
    ),
  );

  app.get(
    "/api/v1/profiles/:fiscalcode/services/:serviceId/preferences",
    GetServicePreferences(
      profileModel,
      serviceModel,
      servicePreferencesModel,
      activationModel,
      redisClientTask,
      serviceCacheTTL,
    ),
  );

  app.get(
    "/api/v1/user-data-processing/:fiscalcode/:choice",
    GetUserDataProcessing(userDataProcessingModel),
  );

  app.post(
    "/api/v1/notify-login",
    NoticeLoginEmail(createTracker(telemetryClient)),
  );

  app.post(
    "/api/v1/email-validation-process/:fiscalcode",
    StartEmailValidationProcess(profileModel),
  );

  app.post(
    "/api/v1/profiles/:fiscalcode/services/:serviceId/preferences",
    UpsertServicePreferences(
      telemetryClient,
      profileModel,
      serviceModel,
      servicePreferencesModel,
      activationModel,
      subscriptionFeedTableService,
      config.SUBSCRIPTIONS_FEED_TABLE,
      redisClientTask,
      serviceCacheTTL,
    ),
  );

  app.post(
    "/api/v1/user-data-processing/:fiscalcode",
    UpsertUserDataProcessing(userDataProcessingModel),
  );

  // ////////////////////////

  return app;
};

export const expressToAzureFunction =
  (app: Express): AzureFunction =>
  (context: Context): void => {
    setAppContext(app, context);
    createAzureFunctionHandler(app)(context);
  };
