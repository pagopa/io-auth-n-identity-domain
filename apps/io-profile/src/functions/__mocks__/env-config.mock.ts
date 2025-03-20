import { DateFromTimestamp } from "@pagopa/ts-commons/lib/dates";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { IConfig } from "../../config";

export const envConfig = {
  isProduction: false,

  COSMOSDB_CONNECTION_STRING: "aConnectionString" as NonEmptyString,
  COSMOSDB_NAME: "aName" as NonEmptyString,

  FUNCTIONS_PUBLIC_URL: "aaa" as NonEmptyString,

  PUBLIC_API_KEY: "aaa" as NonEmptyString,
  PUBLIC_API_URL: "aaa" as NonEmptyString,

  EventsQueueStorageConnection: "aaa" as NonEmptyString,
  EventsQueueName: "aaa" as NonEmptyString,
  MIGRATE_SERVICES_PREFERENCES_PROFILE_QUEUE_NAME: "aaa" as NonEmptyString,
  QueueStorageConnection: "aaa" as NonEmptyString,

  SUBSCRIPTIONS_FEED_TABLE: "aaa" as NonEmptyString,

  OPT_OUT_EMAIL_SWITCH_DATE: "1577836800000" as unknown as DateFromTimestamp,

  IS_CASHBACK_ENABLED: true,

  // MailerConfig
  MAIL_FROM: "aaa" as NonEmptyString,
  MAILHOG_HOSTNAME: "aaa" as NonEmptyString,

  NODE_ENV: "production",
  REQ_SERVICE_ID: undefined,
} as unknown as IConfig; // Not all the required envs are included in this mock
