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
): Client =>
  createClient<"token">({
    baseUrl: BACKEND_INTERNAL_BASE_URL.href,
    fetchApi,
    // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
    withDefaults: op => params =>
      op({
        ...params,
        token: BACKEND_INTERNAL_API_KEY
      })
  });
