/**
 * Config module
 *
 * Single point of access for the application confguration. Handles validation on required environment variables.
 * The configuration is evaluate eagerly at the first access to the module. The module exposes convenient methods to access such value.
 */
import { MailerConfig } from "@pagopa/io-functions-commons/dist/src/mailer";
import { readableReport } from "@pagopa/ts-commons/lib/reporters";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { withDefault } from "@pagopa/ts-commons/lib/types";
import { UrlFromString } from "@pagopa/ts-commons/lib/url";
import * as E from "fp-ts/lib/Either";
import { pipe } from "fp-ts/lib/function";
import * as t from "io-ts";
import { BooleanFromString, NumberFromString, withFallback } from "io-ts-types";

export const SessionManagerInternalConfig = t.type({
  SESSION_MANAGER_INTERNAL_BASE_URL: UrlFromString,
  SESSION_MANAGER_INTERNAL_API_KEY: NonEmptyString
});

export type SessionManagerInternalConfig = t.TypeOf<
  typeof SessionManagerInternalConfig
>;

export const FunctionProfileConfig = t.type({
  FUNCTION_PROFILE_BASE_URL: UrlFromString,
  FUNCTION_PROFILE_API_KEY: NonEmptyString
});

export type FunctionProfileConfig = t.TypeOf<typeof FunctionProfileConfig>;

export const DryRunFeatureFlag = t.type({
  FF_DRY_RUN: withFallback(BooleanFromString, false)
});

export type DryRunFeatureFlag = t.TypeOf<typeof DryRunFeatureFlag>;

export const ExpiredSessionDiscovererConfig = t.type({
  EXPIRED_SESSION_ADVISOR_QUEUE: NonEmptyString,
  EXPIRED_SESSION_SCANNER_TIMEOUT_MULTIPLIER: withFallback(NumberFromString, 7),
  SESSION_NOTIFICATIONS_CONTAINER_NAME: NonEmptyString
});

export type ExpiredSessionDiscovererConfig = t.TypeOf<
  typeof ExpiredSessionDiscovererConfig
>;

export const SessionNotificationsRepositoryConfig = t.type({
  SESSION_NOTIFICATION_EVENTS_TTL_OFFSET: withFallback(
    NumberFromString,
    432000 // 5 days in seconds
  ),
  SESSION_NOTIFICATION_EVENTS_FETCH_CHUNK_SIZE: withFallback(
    NumberFromString,
    100
  )
});

export type SessionNotificationsRepositoryConfig = t.TypeOf<
  typeof SessionNotificationsRepositoryConfig
>;

export const SessionNotificationEventsProcessorConfig = t.type({
  SERVICEBUS_NOTIFICATION_EVENT_SUBSCRIPTION_MAX_DELIVERY_COUNT: NumberFromString
});

export type SessionNotificationEventsProcessorConfig = t.TypeOf<
  typeof SessionNotificationEventsProcessorConfig
>;

// global app configuration
export type IConfig = t.TypeOf<typeof IConfig>;
export const IConfig = t.intersection([
  t.type({
    APPLICATIONINSIGHTS_CONNECTION_STRING: NonEmptyString,

    AZURE_STORAGE_CONNECTION_STRING: NonEmptyString,
    AZURE_STORAGE_CONNECTION_STRING_ITN: NonEmptyString,

    // Old general CosmosDB
    COSMOSDB_NAME: NonEmptyString,
    COSMOSDB_CONNECTION_STRING: NonEmptyString,

    // Domain Centric new CosmosDB
    CITIZEN_AUTH_COSMOSDB_NAME: NonEmptyString,
    CITIZEN_AUTH_COSMOSDB_CONNECTION_STRING: NonEmptyString,

    // Default is 10 sec timeout
    FETCH_TIMEOUT_MS: withDefault(t.string, "10000").pipe(NumberFromString),

    // Expired Session Email Config
    EXPIRED_SESSION_CTA_URL: UrlFromString,

    // MigrateServicePreferenceFromLegacy Config
    MAINTENANCE_STORAGE_ACCOUNT_CONNECTION_STRING: NonEmptyString,
    MIGRATE_SERVICES_PREFERENCES_PROFILE_QUEUE_NAME: NonEmptyString,

    ON_PROFILE_UPDATE_LEASES_PREFIX: NonEmptyString,
    // TODO: cleanup after ITN migration
    PROFILE_EMAIL_STORAGE_TABLE_NAME: NonEmptyString,
    PROFILE_EMAIL_STORAGE_TABLE_NAME_ITN: NonEmptyString,
    // StoreSpidLogs Config
    IOPSTLOGS_STORAGE_CONNECTION_STRING: NonEmptyString,
    SPID_LOGS_PUBLIC_KEY: NonEmptyString,

    isProduction: t.boolean
  }),
  t.intersection([
    SessionManagerInternalConfig,
    FunctionProfileConfig,
    MailerConfig,
    DryRunFeatureFlag,
    ExpiredSessionDiscovererConfig
  ]),
  SessionNotificationEventsProcessorConfig,
  SessionNotificationsRepositoryConfig
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
