import { getRequiredENVVar } from "../utils/environment";

export const PLATFORM_PROXY_API_URL = getRequiredENVVar(
  "PLATFORM_PROXY_API_URL",
);
