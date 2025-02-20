import { IConfig } from "../../config";
import {
  Client,
  createClient
} from "../../generated/definitions/function-profile/client";

export type FunctionProfileClientDependency = {
  readonly functionProfileClient: Client<"SubscriptionKey">;
};

export const buildFunctionProfileClient = (
  fetchApi: typeof fetch,
  { FUNCTION_PROFILE_API_KEY, FUNCTION_PROFILE_BASE_URL }: IConfig
): Client => {
  const baseUrlHref = FUNCTION_PROFILE_BASE_URL.href;
  return createClient<"SubscriptionKey">({
    baseUrl: baseUrlHref.endsWith("/") ? baseUrlHref.slice(0, -1) : baseUrlHref,
    fetchApi,
    // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
    withDefaults: op => params =>
      op({
        ...params,
        SubscriptionKey: FUNCTION_PROFILE_API_KEY
      })
  });
};
