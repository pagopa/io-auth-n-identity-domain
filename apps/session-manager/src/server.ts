import * as O from "fp-ts/Option";
import { pipe } from "fp-ts/lib/function";

import { newApp } from "./app";
import { AppInsightsConfig } from "./config";
import { log } from "./utils/logger";
import { initAppInsights } from "./utils/appinsights";
import { getCurrentBackendVersion } from "./utils/package";

// eslint-disable-next-line turbo/no-undeclared-env-vars
const port = process.env.WEBSITES_PORT ?? 3000;

const maybeAppInsightsClient = pipe(
  AppInsightsConfig.APPLICATIONINSIGHTS_CONNECTION_STRING,
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
    app.listen(port, () => {
      log.info(`Example app listening on port ${port}`);
    });
  })
  .catch((err) => {
    log.error("Error loading app: %s", err);
    process.exit(1);
  });
