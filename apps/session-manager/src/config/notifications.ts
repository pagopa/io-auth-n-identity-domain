import { getRequiredENVVar } from "../utils/environment";

// Needed to forward push notifications actions events
export const PUSH_NOTIFICATIONS_STORAGE_CONNECTION_STRING = getRequiredENVVar(
  "PUSH_NOTIFICATIONS_STORAGE_CONNECTION_STRING",
);
export const PUSH_NOTIFICATIONS_QUEUE_NAME = getRequiredENVVar(
  "PUSH_NOTIFICATIONS_QUEUE_NAME",
);
