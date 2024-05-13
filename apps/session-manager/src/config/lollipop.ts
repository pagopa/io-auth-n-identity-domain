import { getRequiredENVVar } from "../utils/environment";

export const FF_LOLLIPOP_ENABLED = process.env.FF_LOLLIPOP_ENABLED === "1";
export const LOLLIPOP_REVOKE_STORAGE_CONNECTION_STRING = getRequiredENVVar(
  "LOLLIPOP_REVOKE_STORAGE_CONNECTION_STRING",
);
export const LOLLIPOP_REVOKE_QUEUE_NAME = getRequiredENVVar(
  "LOLLIPOP_REVOKE_QUEUE_NAME",
);
export const LOLLIPOP_API_KEY = getRequiredENVVar("LOLLIPOP_API_KEY");
export const LOLLIPOP_API_URL = getRequiredENVVar("LOLLIPOP_API_URL");
export const LOLLIPOP_API_BASE_PATH = getRequiredENVVar(
  "LOLLIPOP_API_BASE_PATH",
);
