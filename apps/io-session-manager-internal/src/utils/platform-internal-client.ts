import {
  createClient,
  Client,
} from "../generated/client/platform-proxy/client";
import nodeFetch from "node-fetch";

export function getPlatformInternalApiClient(
  baseUrl: string,
  basePath?: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fetchApi: typeof fetch = nodeFetch as any as typeof fetch,
): Client<"_____"> {
  return createClient({
    basePath,
    baseUrl,
    fetchApi,
  });
}

export type PlatformInternalApiClient = ReturnType<
  typeof getPlatformInternalApiClient
>;
