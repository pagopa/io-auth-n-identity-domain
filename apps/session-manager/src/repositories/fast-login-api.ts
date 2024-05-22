import * as nodeFetch from "node-fetch";
import { createClient, Client } from "../generated/fast-login-api/client";

export function getFnFastLoginAPIClient(
  token: string,
  baseUrl: string,
  basePath?: string,
  // TODO: customize fetch with timeout
  fetchApi: typeof fetch = nodeFetch as unknown as typeof fetch,
): Client<"ApiKeyAuth"> {
  return createClient<"ApiKeyAuth">({
    basePath,
    baseUrl,
    fetchApi,
    withDefaults: (op) => (params) =>
      op({
        ...params,
        ApiKeyAuth: token,
      }),
  });
}

export type FnFastLoginAPIClient = typeof getFnFastLoginAPIClient;

export type FnFastLoginRepositoryDeps = {
  fnFastLoginAPIClient: ReturnType<FnFastLoginAPIClient>;
};
