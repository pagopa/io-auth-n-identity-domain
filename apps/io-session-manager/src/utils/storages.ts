import { TableClient } from "@azure/data-tables";
import { QueueClient } from "@azure/storage-queue";
import { CustomTableClient } from "@pagopa/azure-storage-data-table-migration-kit";
import {
  LOCKED_PROFILES_STORAGE_CONNECTION_STRING,
  LOCKED_PROFILES_STORAGE_CONNECTION_STRING_ITN,
  LOCKED_PROFILES_TABLE_NAME,
  LOCKED_PROFILES_TABLE_NAME_ITN,
} from "../config/lock-profile";
import {
  LOLLIPOP_REVOKE_STORAGE_CONNECTION_STRING,
  LOLLIPOP_REVOKE_QUEUE_NAME,
} from "../config/lollipop";
import {
  PUSH_NOTIFICATIONS_STORAGE_CONNECTION_STRING,
  PUSH_NOTIFICATIONS_QUEUE_NAME,
} from "../config/notifications";
import { SpidLogConfig, isDevEnv } from "../config";

export const initStorageDependencies = () => {
  const lockUserTableClientOld = TableClient.fromConnectionString(
    LOCKED_PROFILES_STORAGE_CONNECTION_STRING,
    LOCKED_PROFILES_TABLE_NAME,
    { allowInsecureConnection: isDevEnv },
  );

  const lockUserTableClientItn = TableClient.fromConnectionString(
    LOCKED_PROFILES_STORAGE_CONNECTION_STRING_ITN,
    LOCKED_PROFILES_TABLE_NAME_ITN,
    { allowInsecureConnection: isDevEnv },
  );

  const lockUserTableClient = new CustomTableClient(
    () => void 0,
    lockUserTableClientOld,
    lockUserTableClientItn,
  );

  const lollipopRevokeQueueClient = new QueueClient(
    LOLLIPOP_REVOKE_STORAGE_CONNECTION_STRING,
    LOLLIPOP_REVOKE_QUEUE_NAME,
  );

  const notificationQueueClient = new QueueClient(
    PUSH_NOTIFICATIONS_STORAGE_CONNECTION_STRING,
    PUSH_NOTIFICATIONS_QUEUE_NAME,
  );

  // Create the Client to the Spid Log Queue
  const spidLogQueueClient = new QueueClient(
    SpidLogConfig.SPID_LOG_STORAGE_CONNECTION_STRING,
    SpidLogConfig.SPID_LOG_QUEUE_NAME,
  );

  return {
    lockUserTableClient,
    lollipopRevokeQueueClient,
    notificationQueueClient,
    spidLogQueueClient,
  };
};
