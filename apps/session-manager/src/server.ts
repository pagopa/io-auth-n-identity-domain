import { Server } from "http";
import * as appInsights from "applicationinsights";

import * as O from "fp-ts/Option";
import { pipe } from "fp-ts/lib/function";

import { newApp } from "./app";
import { AppInsightsConfig } from "./config";
import {
  StartupEventName,
  initAppInsights,
  trackStartupTime,
} from "./utils/appinsights";
import { log } from "./utils/logger";
import { getCurrentBackendVersion } from "./utils/package";
import { TimeTracer } from "./utils/timer";

const timer = TimeTracer();

// eslint-disable-next-line turbo/no-undeclared-env-vars
const port = process.env.WEBSITES_PORT ?? 3000;

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

newApp({ appInsightsClient: maybeAppInsightsClient })
  .then((app) => {
    const server = app
      .listen(port, () => {
        const startupTimeMs = timer.getElapsedMilliseconds();

        log.info("Listening on port %d", port);
        log.info(`Startup time: %sms`, startupTimeMs.toString());
        pipe(
          maybeAppInsightsClient,
          O.fromNullable,
          O.map((_) =>
            trackStartupTime(_, StartupEventName.SERVER, startupTimeMs),
          ),
        );
      })
      .on("close", () => {
        log.info("On close: emit 'server:stop' event");
        const result = app.emit("server:stop");
        log.info(
          `On close: end emit 'server:stop' event. Listeners found: ${result}`,
        );

        maybeAppInsightsClient?.flush();
        appInsights.dispose();
      });

    process.on("SIGTERM", shutDown(server, "SIGTERM"));
    process.on("SIGINT", shutDown(server, "SIGINT"));
  })
  .catch((err) => {
    log.error("Error loading app: %s", err);
    process.exit(1);
  });

const shutDown = (server: Server, signal: string) => () => {
  log.info(`${signal} signal received: closing HTTP server`);
  server.close(() => {
    log.info("HTTP server closed");
  });
};
