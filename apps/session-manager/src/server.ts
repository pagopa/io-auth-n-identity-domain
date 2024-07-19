import * as appInsights from "applicationinsights";

import * as O from "fp-ts/Option";
import { pipe } from "fp-ts/lib/function";

import * as E from "fp-ts/Either";
import { newApp } from "./app";
import {
  AppInsightsConfig,
  isDevEnv,
  EVENT_LOOP_DELAY_THREASHOLD,
} from "./config";
import {
  StartupEventName,
  initAppInsights,
  trackStartupTime,
} from "./utils/appinsights";
import { log } from "./utils/logger";
import { getCurrentBackendVersion } from "./utils/package";
import { TimeTracer } from "./utils/timer";
import { RedisClientMode } from "./types/redis";
import { initHttpGracefulShutdown } from "./utils/graceful-shutdown";
import {
  PORT,
  SHUTDOWN_SIGNALS,
  SHUTDOWN_TIMEOUT_MILLIS,
} from "./config/server";
import { AppWithRefresherTimer } from "./utils/express";
import { RedisRepo } from "./repositories";
import { startMeasuringEventLoop } from "./utils/middlewares/server-load";

const timer = TimeTracer();

const maybeAppInsightsClient = pipe(
  AppInsightsConfig.APPINSIGHTS_CONNECTION_STRING,
  O.map((key) =>
    initAppInsights(key, {
      cloudRole: AppInsightsConfig.APPINSIGHTS_CLOUD_ROLE_NAME,
      applicationVersion: getCurrentBackendVersion(),
      disableAppInsights: AppInsightsConfig.APPINSIGHTS_DISABLED,
      samplingPercentage: AppInsightsConfig.APPINSIGHTS_SAMPLING_PERCENTAGE,
    }),
  ),
  O.toUndefined,
);

/**
 * Utility method used to start the server using a Express Application.
 * This is usefull to mocktesting the startup process whidout creating a real
 * http server.
 *
 * @param appTask An async express App decorated with additional params
 */
export const serverStarter = (
  appTask: Promise<AppWithRefresherTimer & RedisRepo.RedisRepositoryDeps>,
) =>
  appTask.then(({ app, startIdpMetadataRefreshTimer, redisClientSelector }) => {
    // Initialize the handler for the graceful shutdown
    app.on("server:stop", () => {
      // Clear refresher interval
      clearInterval(startIdpMetadataRefreshTimer);
      // Graceful redis connection shutdown.
      for (const client of redisClientSelector.select(RedisClientMode.ALL)) {
        log.info(`Gracefully closing redis connection`);

        client
          .quit()
          .catch((err) =>
            log.error(
              `An Error occurred closing the redis connection: [${
                E.toError(err).message
              }]`,
            ),
          );
      }

      // Dispose the Application Insights client
      maybeAppInsightsClient?.flush();
      appInsights.dispose();
    });
    const server = app.listen(PORT, () => {
      const startupTimeMs = timer.getElapsedMilliseconds();

      log.info("Listening on port %d", PORT);
      log.info(`Startup time: %sms`, startupTimeMs.toString());
      pipe(
        maybeAppInsightsClient,
        O.fromNullable,
        O.map((_) =>
          trackStartupTime(_, StartupEventName.SERVER, startupTimeMs),
        ),
      );
    });

    initHttpGracefulShutdown(server, app, {
      development: isDevEnv,
      finally: () => {
        log.info("Server graceful shutdown complete.");
      },
      signals: SHUTDOWN_SIGNALS,
      timeout: SHUTDOWN_TIMEOUT_MILLIS,
    });

    startMeasuringEventLoop(
      { EVENT_LOOP_DELAY_THREASHOLD },
      app,
      maybeAppInsightsClient,
    );

    return app;
  });

serverStarter(
  newApp({
    appInsightsClient: maybeAppInsightsClient,
  }),
).catch((err) => {
  log.error("Error loading app: %s", err);
  process.exit(1);
});
