import {
  readableReport,
  readableReportSimplified,
} from "@pagopa/ts-commons/lib/reporters";
import { CommaSeparatedListOf } from "@pagopa/ts-commons/lib/comma-separated-list";
import {
  FeatureFlag,
  FeatureFlagEnum,
} from "@pagopa/ts-commons/lib/featureFlag";
import { FiscalCode, NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { withDefault } from "@pagopa/ts-commons/lib/types";
import { flow, pipe } from "fp-ts/lib/function";
import * as t from "io-ts";
import * as E from "fp-ts/lib/Either";
import * as O from "fp-ts/lib/Option";
import { BooleanFromString } from "io-ts-types";

const ApplicationInsightsConfig = t.intersection([
  t.type({
    APPLICATIONINSIGHTS_CONNECTION_STRING: NonEmptyString,
    APPINSIGHTS_REDIS_TRACE_ENABLED: withDefault(t.string, "false").pipe(
      BooleanFromString,
    ),
  }),
  t.partial({
    APPINSIGHTS_DISABLE: withDefault(t.string, "false").pipe(BooleanFromString),
  }),
]);

const RedisClientConfig = t.intersection([
  t.type({
    REDIS_TLS_ENABLED: withDefault(t.boolean, true),
    REDIS_URL: NonEmptyString,
  }),
  t.partial({
    REDIS_PASSWORD: NonEmptyString,
    REDIS_PORT: NonEmptyString,
  }),
]);

const ServiceBusConfig = t.intersection([
  t.type({
    SERVICE_BUS_NAMESPACE: NonEmptyString,
    AUTH_SESSIONS_TOPIC_NAME: NonEmptyString,
  }),
  t.partial({
    DEV_SERVICE_BUS_CONNECTION_STRING: NonEmptyString,
  }),
]);

export type RedisClientConfig = t.TypeOf<typeof RedisClientConfig>;

export type IConfig = t.TypeOf<typeof IConfig>;
export const IConfig = t.intersection([
  t.interface({
    isProduction: t.boolean,
  }),
  ApplicationInsightsConfig,
  RedisClientConfig,
  ServiceBusConfig,
  t.type({
    // Locked profiles config
    LOCKED_PROFILES_STORAGE_CONNECTION_STRING: NonEmptyString,
    LOCKED_PROFILES_TABLE_NAME: NonEmptyString,

    // Push notifications queue config
    PUSH_NOTIFICATIONS_STORAGE_CONNECTION_STRING: NonEmptyString,
    PUSH_NOTIFICATIONS_QUEUE_NAME: NonEmptyString,

    // Lollipop revoke queue config
    LOLLIPOP_REVOKE_STORAGE_CONNECTION_STRING: NonEmptyString,
    LOLLIPOP_REVOKE_QUEUE_NAME: NonEmptyString,
  }),
]);

export const envConfig = {
  ...process.env,
  REDIS_TLS_ENABLED:
    process.env.REDIS_TLS_ENABLED &&
    process.env.REDIS_TLS_ENABLED.toString() === "true",
  isProduction: process.env.NODE_ENV === "production",
};

const errorOrConfig: t.Validation<IConfig> = IConfig.decode(envConfig);

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
        `Invalid configuration: ${readableReportSimplified(errors)}`,
      );
    }),
  );

export const FF_SERVICE_BUS_EVENTS = pipe(
  process.env.SERVICE_BUS_EVENTS,
  FeatureFlag.decode,
  E.getOrElseW(() => FeatureFlagEnum.NONE),
);

export const SERVICE_BUS_EVENTS_USERS: ReadonlyArray<FiscalCode> = pipe(
  process.env.SERVICE_BUS_EVENTS_USERS,
  O.fromNullable,
  O.map(
    flow(
      CommaSeparatedListOf(FiscalCode).decode,
      E.getOrElseW((err) => {
        throw new Error(
          `Invalid SERVICE_BUS_EVENTS_USERS value: ${readableReport(err)}`,
        );
      }),
    ),
  ),
  O.getOrElseW(() => []),
);
