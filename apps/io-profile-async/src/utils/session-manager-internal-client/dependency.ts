import { IConfig } from "../../config";
import {
  Client,
  createClient
} from "../../generated/definitions/sm-internal/client";

export type SessionManagerInternalClientDependency = {
  readonly sessionManagerInternalClient: Client<"ApiKeyAuth">;
};

export const buildSessionManagerInternalClient = (
  fetchApi: typeof fetch,
  {
    SESSION_MANAGER_INTERNAL_API_KEY,
    SESSION_MANAGER_INTERNAL_BASE_URL
  }: IConfig
): Client<"ApiKeyAuth"> => {
  const baseUrlHref = SESSION_MANAGER_INTERNAL_BASE_URL.href;

  return createClient<"ApiKeyAuth">({
    baseUrl: baseUrlHref.endsWith("/") ? baseUrlHref.slice(0, -1) : baseUrlHref,
    fetchApi,
    // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
    withDefaults: op => params =>
      op({
        ...params,
        ApiKeyAuth: SESSION_MANAGER_INTERNAL_API_KEY
      })
  });
};
