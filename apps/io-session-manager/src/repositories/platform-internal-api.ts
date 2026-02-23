import nodeFetch from "node-fetch";
import { Client, createClient } from "../generated/platform-internal/client";

export function getPlatformInternalApiClient(
  baseUrl: string,
  basePath: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fetchApi: typeof fetch = nodeFetch as any as typeof fetch,
): Client<"_____"> {
  return createClient({
    basePath,
    baseUrl,
    fetchApi,
  });
}

type PlatformInternalApiClient = ReturnType<
  typeof getPlatformInternalApiClient
>;

export type PlatformInternalApiDeps = {
  platformInternalApiClient: PlatformInternalApiClient;
};
