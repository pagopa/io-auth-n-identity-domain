/**
 * Config module
 *
 * Single point of access for the application confguration. Handles validation on required environment variables.
 * The configuration is evaluate eagerly at the first access to the module. The module exposes convenient methods to access such value.
 */

import * as t from "io-ts";

import * as E from "fp-ts/lib/Either";
import { pipe } from "fp-ts/lib/function";
import { withFallback } from "io-ts-types";

import { CommaSeparatedListOf } from "@pagopa/ts-commons/lib/comma-separated-list";
import { readableReport } from "@pagopa/ts-commons/lib/reporters";

import { NumberFromString } from "@pagopa/ts-commons/lib/numbers";
import { FiscalCode, NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { withDefault } from "@pagopa/ts-commons/lib/types";
import { FeatureFlag, FeatureFlagEnum } from "./featureFlags/featureFlags";

// global app configuration
export type IConfig = t.TypeOf<typeof IConfig>;
// eslint-disable-next-line @typescript-eslint/ban-types

export type JWTConfig = t.TypeOf<typeof JWTConfig>;
export const JWTConfig = t.intersection([
  t.type({
    BEARER_AUTH_HEADER: NonEmptyString,
    BLACKLISTED_JTI_LIST: withDefault(CommaSeparatedListOf(NonEmptyString), []),
    EXCHANGE_JWT_ISSUER: NonEmptyString,
    EXCHANGE_JWT_PRIMARY_PRIVATE_KEY: NonEmptyString,
    EXCHANGE_JWT_PRIMARY_PUB_KEY: NonEmptyString,
    // Default 1h = 3600 seconds
    EXCHANGE_JWT_TTL: withDefault(t.string, "3600").pipe(NumberFromString),
    HUB_SPID_LOGIN_JWT_ISSUER: NonEmptyString,
    HUB_SPID_LOGIN_JWT_PUB_KEY: NonEmptyString,
    MAGIC_LINK_BASE_URL: NonEmptyString,
    MAGIC_LINK_JWE_ISSUER: NonEmptyString,
    MAGIC_LINK_JWE_PRIMARY_PRIVATE_KEY: NonEmptyString,
    MAGIC_LINK_JWE_PRIMARY_PUB_KEY: NonEmptyString,
    // Default 7d = 604800 seconds
    MAGIC_LINK_JWE_TTL: withDefault(t.string, "604800").pipe(NumberFromString)
  }),
  t.partial({
    EXCHANGE_JWT_SECONDARY_PUB_KEY: NonEmptyString,
    MAGIC_LINK_JWE_SECONDARY_PRIVATE_KEY: NonEmptyString,
    MAGIC_LINK_JWE_SECONDARY_PUB_KEY: NonEmptyString
  })
]);

export type HSLConfig = t.TypeOf<typeof HSLConfig>;
export const HSLConfig = t.intersection([
  t.type({
    HUB_SPID_LOGIN_API_KEY: NonEmptyString,
    HUB_SPID_LOGIN_CLIENT_BASE_URL: NonEmptyString
  }),
  t.partial({
    HUB_SPID_LOGIN_MOCK_TOKEN: NonEmptyString
  })
]);

// Fast Login Client Configuration
export const FastLoginClientConfig = t.type({
  FAST_LOGIN_API_KEY: NonEmptyString,
  FAST_LOGIN_CLIENT_BASE_URL: NonEmptyString
});
export type FastLoginClientConfig = t.TypeOf<typeof FastLoginClientConfig>;

// Fast Login Client Configuration
export const FunctionsAppClientConfig = t.type({
  FUNCTIONS_APP_API_KEY: NonEmptyString,
  FUNCTIONS_APP_CLIENT_BASE_URL: NonEmptyString
});
export type FunctionsAppClientConfig = t.TypeOf<
  typeof FunctionsAppClientConfig
>;

export const IConfig = t.intersection([
  t.interface({
    AUDIT_LOG_CONNECTION_STRING: NonEmptyString,
    AUDIT_LOG_CONTAINER: NonEmptyString,
    BETA_TESTERS: CommaSeparatedListOf(FiscalCode),
    FF_API_ENABLED: withFallback(FeatureFlag, FeatureFlagEnum.NONE),
    isProduction: t.boolean
  }),
  JWTConfig,
  FastLoginClientConfig,
  FunctionsAppClientConfig,
  HSLConfig
]);

export const envConfig = {
  ...process.env,
  isProduction: process.env.NODE_ENV === "production"
};

// No need to re-evaluate this object for each call
const errorOrConfig: t.Validation<IConfig> = IConfig.decode(envConfig);

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
    E.getOrElseW((errors: ReadonlyArray<t.ValidationError>) => {
      throw new Error(`Invalid configuration: ${readableReport(errors)}`);
    })
  );
