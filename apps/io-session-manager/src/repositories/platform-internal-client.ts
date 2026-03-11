import nodeFetch from "node-fetch";
import { Client, createClient } from "../generated/platform-internal/client";

export function getPlatformInternalAPIClient(
  baseUrl: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fetchApi: typeof fetch = nodeFetch as any as typeof fetch,
): Client<"_____"> {
  return createClient({
    baseUrl,
    fetchApi,
  });
}

type PlatformInternalAPIClient = ReturnType<
  typeof getPlatformInternalAPIClient
>;

export type PlatformInternalClientDeps = {
  platformInternalAPIClient: PlatformInternalAPIClient;
};
