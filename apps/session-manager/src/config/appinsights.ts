/* eslint-disable turbo/no-undeclared-env-vars */
import * as O from "fp-ts/Option";
import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/lib/function";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";

export const APPINSIGHTS_CONNECTION_STRING = O.fromNullable(
  process.env.APPINSIGHTS_CONNECTION_STRING,
);

export const APPINSIGHTS_CLOUD_ROLE_NAME = pipe(
  process.env.APPINSIGHTS_CLOUD_ROLE_NAME,
  NonEmptyString.decode,
  E.getOrElseW(() => undefined),
);

export const APPINSIGHTS_DISABLED = process.env.APPINSIGHTS_DISABLED === "true";

// Application insights sampling percentage
const DEFAULT_APPINSIGHTS_SAMPLING_PERCENTAGE = 5;
export const APPINSIGHTS_SAMPLING_PERCENTAGE = process.env
  .APPINSIGHTS_SAMPLING_PERCENTAGE
  ? parseInt(process.env.APPINSIGHTS_SAMPLING_PERCENTAGE, 10)
  : DEFAULT_APPINSIGHTS_SAMPLING_PERCENTAGE;

// Enable Redis dependency trace
export const APPINSIGHTS_REDIS_TRACE_ENABLED =
  process.env.APPINSIGHTS_REDIS_TRACE_ENABLED === "true";
