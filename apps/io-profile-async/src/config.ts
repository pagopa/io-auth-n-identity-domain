/**
 * Config module
 *
 * Single point of access for the application confguration. Handles validation on required environment variables.
 * The configuration is evaluate eagerly at the first access to the module. The module exposes convenient methods to access such value.
 */
import { MailerConfig } from "@pagopa/io-functions-commons/dist/src/mailer";
import {
  FeatureFlag,
  FeatureFlagEnum
} from "@pagopa/ts-commons/lib/featureFlag";
import { readableReport } from "@pagopa/ts-commons/lib/reporters";
import { FiscalCode, NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { withDefault } from "@pagopa/ts-commons/lib/types";
import { UrlFromString } from "@pagopa/ts-commons/lib/url";
import * as E from "fp-ts/lib/Either";
import { pipe } from "fp-ts/lib/function";
import * as t from "io-ts";
import { JsonFromString, NumberFromString, withFallback } from "io-ts-types";

export const BetaUsers = t.readonlyArray(FiscalCode);
export type BetaUsers = t.TypeOf<typeof BetaUsers>;

export const BetaUsersFromString = withFallback(
  t.string.pipe(JsonFromString),
  []
).pipe(BetaUsers);

export const FeatureFlagFromString = withFallback(
  FeatureFlag,
  FeatureFlagEnum.NONE
);

export const BackendInternalConfig = t.type({
  BACKEND_INTERNAL_BASE_URL: UrlFromString,
  BACKEND_INTERNAL_API_KEY: NonEmptyString
});

export type BackendInternalConfig = t.TypeOf<typeof BackendInternalConfig>;

export const FunctionProfileConfig = t.type({
  FUNCTION_PROFILE_BASE_URL: UrlFromString,
  FUNCTION_PROFILE_API_KEY: NonEmptyString
});

export type FunctionProfileConfig = t.TypeOf<typeof FunctionProfileConfig>;

// global app configuration
export type IConfig = t.TypeOf<typeof IConfig>;
export const IConfig = t.intersection([
  t.type({
    APPLICATIONINSIGHTS_CONNECTION_STRING: NonEmptyString,

    AZURE_STORAGE_CONNECTION_STRING: NonEmptyString,

    COSMOSDB_KEY: NonEmptyString,
    COSMOSDB_NAME: NonEmptyString,
    COSMOSDB_URI: NonEmptyString,

    // Default is 10 sec timeout
    FETCH_TIMEOUT_MS: withDefault(t.string, "10000").pipe(NumberFromString),

    isProduction: t.boolean
  }),
  BackendInternalConfig,
  FunctionProfileConfig,
  MailerConfig
]);

// No need to re-evaluate this object for each call
const errorOrConfig: t.Validation<IConfig> = IConfig.decode({
  ...process.env,
  isProduction: process.env.NODE_ENV === "production"
});

/**
 * Read the application configuration and check for invalid values.
 * Configuration is eagerly evalued when the application starts.
 *
 * @returns either the configuration values or a list of validation errors
 */
export const getConfig = (): t.Validation<IConfig> => errorOrConfig;

/**
 * Read the application configuration and check for invalid values.
 * If the application is not valid, raises an exception.
 *
 * @returns the configuration values
 * @throws validation errors found while parsing the application configuration
 */
export const getConfigOrThrow = (): IConfig =>
  pipe(
    errorOrConfig,
    E.getOrElseW(errors => {
      throw new Error(`Invalid configuration: ${readableReport(errors)}`);
    })
  );
