import { getRequiredENVVar } from "../utils/environment";

// Needed to verify if a profile has been locked
export const LOCKED_PROFILES_STORAGE_CONNECTION_STRING = getRequiredENVVar(
  "LOCKED_PROFILES_STORAGE_CONNECTION_STRING",
);
export const LOCKED_PROFILES_TABLE_NAME = getRequiredENVVar(
  "LOCKED_PROFILES_TABLE_NAME",
);

export const LOCKED_PROFILES_STORAGE_CONNECTION_STRING_ITN = getRequiredENVVar(
  "LOCKED_PROFILES_STORAGE_CONNECTION_STRING_ITN",
);
export const LOCKED_PROFILES_TABLE_NAME_ITN = getRequiredENVVar(
  "LOCKED_PROFILES_TABLE_NAME_ITN",
);
