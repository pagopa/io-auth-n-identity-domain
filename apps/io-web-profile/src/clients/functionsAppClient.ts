import {
  Client,
  createClient
} from "../generated/definitions/io-functions-app/client";
import { timeoutFetch } from "../utils/fetch";

export const getFunctionsAppClient = (
  subscriptionKey: string,
  baseUrl: string,
  basePath?: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fetchApi: typeof timeoutFetch = (timeoutFetch as any) as typeof timeoutFetch
): Client<"SubscriptionKey"> =>
  createClient<"SubscriptionKey">({
    basePath,
    baseUrl,
    fetchApi,
    // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
    withDefaults: op => params =>
      op({
        ...params,
        SubscriptionKey: subscriptionKey
      })
  });

export type GetFunctionsAppClient = typeof getFunctionsAppClient;
