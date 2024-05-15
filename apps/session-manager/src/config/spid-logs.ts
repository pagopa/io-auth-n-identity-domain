import { getRequiredENVVar } from "../utils/environment";

// Needed to forward SPID requests for logging
export const SPID_LOG_STORAGE_CONNECTION_STRING = getRequiredENVVar(
  "SPID_LOG_STORAGE_CONNECTION_STRING",
);
export const SPID_LOG_QUEUE_NAME = getRequiredENVVar("SPID_LOG_QUEUE_NAME");
