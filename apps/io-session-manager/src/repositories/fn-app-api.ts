import nodeFetch from "node-fetch";
import { Client, createClient } from "../generated/io-profile/client";

export const FnAppAPIClient = (
  baseUrl: string,
  token: string,
  fetchApi: typeof fetch = nodeFetch as unknown as typeof fetch, // TODO: customize fetch with timeout
): Client<"SubscriptionKey"> =>
  createClient<"SubscriptionKey">({
    baseUrl,
    fetchApi,
    withDefaults: (op) => (params) =>
      op({
        ...params,
        // please refer to source api spec for actual header mapping
        // https://github.com/pagopa/io-functions-app/blob/master/openapi/index.yaml#:~:text=%20%20SubscriptionKey:
        SubscriptionKey: token,
      }),
  });

export type FnAppAPIClient = typeof FnAppAPIClient;

export type FnAppAPIRepositoryDeps = {
  fnAppAPIClient: ReturnType<FnAppAPIClient>;
};
