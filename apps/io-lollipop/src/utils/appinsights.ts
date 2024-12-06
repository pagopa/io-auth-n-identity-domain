import * as ai from "applicationinsights";
import { initAppInsights } from "@pagopa/ts-commons/lib/appinsights";
import { IntegerFromString } from "@pagopa/ts-commons/lib/numbers";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import * as E from "fp-ts/lib/Either";
import * as O from "fp-ts/lib/Option";
import { pipe } from "fp-ts/lib/function";
import {
  EventTelemetry,
  ExceptionTelemetry
} from "applicationinsights/out/Declarations/Contracts";

// the internal function runtime has MaxTelemetryItem per second set to 20 by default
// @see https://github.com/Azure/azure-functions-host/blob/master/src/WebJobs.Script/Config/ApplicationInsightsLoggerOptionsSetup.cs#L29
const DEFAULT_SAMPLING_PERCENTAGE = 5;

// Avoid to initialize Application Insights more than once
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const initTelemetryClient = (
  intrumentationKey: NonEmptyString,
  env = process.env
) =>
  ai.defaultClient
    ? ai.defaultClient
    : initAppInsights(intrumentationKey, {
        disableAppInsights: env.APPINSIGHTS_DISABLE === "true",
        samplingPercentage: pipe(
          IntegerFromString.decode(env.APPINSIGHTS_SAMPLING_PERCENTAGE),
          E.getOrElse(() => DEFAULT_SAMPLING_PERCENTAGE)
        )
      });

export type TelemetryClient = ReturnType<typeof initTelemetryClient>;

export const trackEvent = (
  telemetryClient: TelemetryClient,
  event: EventTelemetry
): void => {
  pipe(
    O.fromNullable(telemetryClient),
    O.map(client => O.tryCatch(() => client.trackEvent(event)))
  );
};

export const trackException = (
  telemetryClient: TelemetryClient,
  event: ExceptionTelemetry
): void => {
  pipe(
    O.fromNullable(telemetryClient),
    O.map(client => O.tryCatch(() => client.trackException(event)))
  );
};
