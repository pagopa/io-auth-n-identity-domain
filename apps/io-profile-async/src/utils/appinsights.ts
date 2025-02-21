import * as ai from "applicationinsights";
import {
  EventTelemetry,
  ExceptionTelemetry
} from "applicationinsights/out/Declarations/Contracts";
import * as E from "fp-ts/lib/Either";
import * as O from "fp-ts/lib/Option";
import { initAppInsights } from "@pagopa/ts-commons/lib/appinsights";
import { IntegerFromString } from "@pagopa/ts-commons/lib/numbers";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { pipe } from "fp-ts/lib/function";

// the internal function runtime has MaxTelemetryItem per second set to 20 by default
// @see https://github.com/Azure/azure-functions-host/blob/master/src/WebJobs.Script/Config/ApplicationInsightsLoggerOptionsSetup.cs#L29
const DEFAULT_SAMPLING_PERCENTAGE = 5;

// Avoid to initialize Application Insights more than once
export const initTelemetryClient = (
  env = process.env
): ai.TelemetryClient | undefined =>
  ai.defaultClient
    ? ai.defaultClient
    : pipe(
        env.APPLICATIONINSIGHTS_CONNECTION_STRING,
        NonEmptyString.decode,
        E.fold(
          _ => undefined,
          conn =>
            initAppInsights(conn, {
              disableAppInsights: env.APPINSIGHTS_DISABLE === "true",
              samplingPercentage: pipe(
                env.APPINSIGHTS_SAMPLING_PERCENTAGE,
                IntegerFromString.decode,
                E.getOrElse(() => DEFAULT_SAMPLING_PERCENTAGE)
              )
            })
        )
      );

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const trackEvent = (event: EventTelemetry) => {
  pipe(
    initTelemetryClient(),
    O.fromNullable,
    O.chain(_ => O.tryCatch(() => _.trackEvent(event)))
  );
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const trackException = (event: ExceptionTelemetry) => {
  pipe(
    initTelemetryClient(),
    O.fromNullable,
    O.chain(_ => O.tryCatch(() => _.trackException(event)))
  );
};
