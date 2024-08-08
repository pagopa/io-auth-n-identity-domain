import { getRequiredENVVar } from "../utils/environment";

export const FN_APP_API_URL = getRequiredENVVar("API_URL");
export const FN_APP_API_KEY = getRequiredENVVar("API_KEY");
