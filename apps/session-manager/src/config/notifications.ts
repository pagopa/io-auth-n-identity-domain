import { getRequiredENVVar } from "../utils/environment";

// Needed to forward push notifications actions events
export const NOTIFICATIONS_STORAGE_CONNECTION_STRING = getRequiredENVVar(
  "NOTIFICATIONS_STORAGE_CONNECTION_STRING",
);
export const NOTIFICATIONS_QUEUE_NAME = getRequiredENVVar(
  "NOTIFICATIONS_QUEUE_NAME",
);
