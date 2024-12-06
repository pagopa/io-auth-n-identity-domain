/**
 * Config module
 *
 * Single point of access for the application confguration. Handles validation on required environment variables.
 * The configuration is evaluate eagerly at the first access to the module. The module exposes convenient methods to access such value.
 */

import * as t from "io-ts";

import * as E from "fp-ts/lib/Either";
import { pipe } from "fp-ts/lib/function";

import * as reporters from "@pagopa/ts-commons/lib/reporters";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import {
  NonNegativeInteger,
  NonNegativeIntegerFromString
} from "@pagopa/ts-commons/lib/numbers";
import { withDefault } from "@pagopa/ts-commons/lib/types";

import { NumberFromString } from "@pagopa/ts-commons/lib/numbers";
import { UrlFromString } from "@pagopa/ts-commons/lib/url";
import { LollipopMethod } from "../generated/definitions/lollipop-first-consumer/LollipopMethod";

const DEFAULT_KEYS_EXPIRE_GRACE_PERIODS_IN_DAYS = 0 as NonNegativeInteger;

// Assertion Client Configuration (itself)
export const FirstLcAssertionClientConfig = t.type({
  EXPECTED_FIRST_LC_ORIGINAL_METHOD: withDefault(t.string, "POST").pipe(
    LollipopMethod
  ),
  EXPECTED_FIRST_LC_ORIGINAL_URL: withDefault(
    t.string,
    "https://api-app.io.pagopa.it/first-lollipop/sign"
  ).pipe(UrlFromString),

  FIRST_LC_ASSERTION_CLIENT_BASE_URL: NonEmptyString,
  FIRST_LC_ASSERTION_CLIENT_SUBSCRIPTION_KEY: NonEmptyString,

  IDP_KEYS_BASE_URL: withDefault(
    t.string,
    "https://api.is.eng.pagopa.it/idp-keys"
  ).pipe(UrlFromString)
});
export type FirstLcAssertionClientConfig = t.TypeOf<
  typeof FirstLcAssertionClientConfig
>;

// ----------------------------
// JWT Configuration
// ----------------------------
export type JWTConfig = t.TypeOf<typeof JWTConfig>;
export const JWTConfig = t.intersection([
  t.type({
    BEARER_AUTH_HEADER: NonEmptyString,
    ISSUER: NonEmptyString,
    // Default 15min = 60s * 15m
    JWT_TTL: withDefault(t.string, "900").pipe(NumberFromString),

    PRIMARY_PRIVATE_KEY: NonEmptyString,
    PRIMARY_PUBLIC_KEY: NonEmptyString
  }),
  t.partial({
    SECONDARY_PUBLIC_KEY: NonEmptyString
  })
]);

// ----------------------------
// Global app configuration
// ----------------------------
export type IConfig = t.TypeOf<typeof IConfig>;
// eslint-disable-next-line @typescript-eslint/ban-types
export const IConfig = t.intersection([
  t.interface({
    APPINSIGHTS_INSTRUMENTATIONKEY: NonEmptyString,
    AzureWebJobsStorage: NonEmptyString,

    COSMOSDB_KEY: NonEmptyString,
    COSMOSDB_NAME: NonEmptyString,
    COSMOSDB_URI: NonEmptyString,
    KEYS_EXPIRE_GRACE_PERIODS_IN_DAYS: withDefault(
      t.string,
      `${DEFAULT_KEYS_EXPIRE_GRACE_PERIODS_IN_DAYS}`
    ).pipe(NonNegativeIntegerFromString),
    LOLLIPOP_ASSERTION_STORAGE_CONNECTION_STRING: NonEmptyString,
    LOLLIPOP_ASSERTION_STORAGE_CONTAINER_NAME: withDefault(
      NonEmptyString,
      "assertions" as NonEmptyString
    ),

    isProduction: t.boolean
  }),
  JWTConfig,
  FirstLcAssertionClientConfig
]);

export const envConfig = {
  ...process.env,
  BEARER_AUTH_HEADER: "x-pagopa-lollipop-auth",
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
      throw new Error(
        `Invalid configuration: ${reporters.readableReportSimplified(errors)}`
      );
    })
  );
