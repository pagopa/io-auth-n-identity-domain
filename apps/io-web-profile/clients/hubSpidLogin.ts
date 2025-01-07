import {
  Client,
  createClient
} from "../generated/definitions/hub-spid-login/client";
import { timeoutFetch } from "../utils/fetch";

export const getHubSpidLoginClient = (
  baseUrl: string,
  basePath?: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fetchApi: typeof timeoutFetch = (timeoutFetch as any) as typeof timeoutFetch
): Client<"_____"> =>
  createClient({
    basePath,
    baseUrl,
    fetchApi
  });

export type GetHubSpidLoginClient = typeof getHubSpidLoginClient;
