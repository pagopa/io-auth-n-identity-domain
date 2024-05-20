import { TableClient } from "@azure/data-tables";
import { QueueClient } from "@azure/storage-queue";
import {
  LOCKED_PROFILES_STORAGE_CONNECTION_STRING,
  LOCKED_PROFILES_TABLE_NAME,
} from "../config/lock-profile";
import {
  USERS_LOGIN_STORAGE_CONNECTION_STRING,
  USERS_LOGIN_QUEUE_NAME,
} from "../config/login";
import {
  LOLLIPOP_REVOKE_STORAGE_CONNECTION_STRING,
  LOLLIPOP_REVOKE_QUEUE_NAME,
} from "../config/lollipop";
import {
  NOTIFICATIONS_STORAGE_CONNECTION_STRING,
  NOTIFICATIONS_QUEUE_NAME,
} from "../config/notifications";
import { SpidLogConfig } from "../config";

export const initStorageDependencies = () => {
  const lockUserTableClient = TableClient.fromConnectionString(
    LOCKED_PROFILES_STORAGE_CONNECTION_STRING,
    LOCKED_PROFILES_TABLE_NAME,
  );

  const loginUserEventQueue = new QueueClient(
    USERS_LOGIN_STORAGE_CONNECTION_STRING,
    USERS_LOGIN_QUEUE_NAME,
  );

  const lollipopRevokeQueueClient = new QueueClient(
    LOLLIPOP_REVOKE_STORAGE_CONNECTION_STRING,
    LOLLIPOP_REVOKE_QUEUE_NAME,
  );

  const notificationQueueClient = new QueueClient(
    NOTIFICATIONS_STORAGE_CONNECTION_STRING,
    NOTIFICATIONS_QUEUE_NAME,
  );

  // Create the Client to the Spid Log Queue
  const spidLogQueueClient = new QueueClient(
    SpidLogConfig.SPID_LOG_STORAGE_CONNECTION_STRING,
    SpidLogConfig.SPID_LOG_QUEUE_NAME,
  );

  return {
    lockUserTableClient,
    loginUserEventQueue,
    lollipopRevokeQueueClient,
    notificationQueueClient,
    spidLogQueueClient,
  };
};
