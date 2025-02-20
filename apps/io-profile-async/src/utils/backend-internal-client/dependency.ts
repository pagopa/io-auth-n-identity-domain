import { IConfig } from "../../config";
import {
  Client,
  createClient
} from "../../generated/definitions/backend-session/client";

export type BackendInternalClientDependency = {
  readonly backendInternalClient: Client<"token">;
};

export const buildIoBackendInternalClient = (
  fetchApi: typeof fetch,
  { BACKEND_INTERNAL_API_KEY, BACKEND_INTERNAL_BASE_URL }: IConfig
): Client => {
  const baseUrlHref = BACKEND_INTERNAL_BASE_URL.href;

  return createClient<"token">({
    baseUrl: baseUrlHref.endsWith("/") ? baseUrlHref.slice(0, -1) : baseUrlHref,
    fetchApi,
    // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
    withDefaults: op => params =>
      op({
        ...params,
        token: BACKEND_INTERNAL_API_KEY
      })
  });
};
