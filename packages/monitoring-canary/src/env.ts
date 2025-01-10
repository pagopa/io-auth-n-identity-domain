import * as t from "io-ts";
import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/function"
import { logger } from "./logger";
import { readableReport } from "@pagopa/ts-commons/lib/reporters";
import { withDefault } from "@pagopa/ts-commons/lib/types";

const CanaryMonitorConfig = t.type({
    FUNCTION_APP_NAME: t.string,
    LOG_ANALITYCS_WORKSPACE_ID: t.string,
    CANARY_INCREMENT_STEP: withDefault(t.number, 10), // 10 percent
    CANARY_NEXT_STEP_AFTER_MS: withDefault(t.Integer, 30000) // 5 minutes
});

export type CanaryMonitorConfig = t.TypeOf<typeof CanaryMonitorConfig>;

const errorOrCanaryConfig: t.Validation<CanaryMonitorConfig> = CanaryMonitorConfig.decode(process.env);

export const getCanaryConfig = (): t.Validation<CanaryMonitorConfig> => errorOrCanaryConfig;

export const getCanaryConfigOrExit = (): CanaryMonitorConfig =>
  pipe(
    errorOrCanaryConfig,
    E.getOrElseW((errors: ReadonlyArray<t.ValidationError>) => {
      logger.error(`Invalid canary configuration: ${readableReport(errors)}`);
      process.exit(1);
    })
  );