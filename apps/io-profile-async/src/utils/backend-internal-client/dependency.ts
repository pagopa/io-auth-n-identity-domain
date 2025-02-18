import { Millisecond } from "@pagopa/ts-commons/lib/units";

import { setFetchTimeout, toFetch } from "@pagopa/ts-commons/lib/fetch";

import { agent } from "@pagopa/ts-commons";
import { AbortableFetch } from "@pagopa/ts-commons/lib/fetch";
import { IConfig } from "../../config";
import {
  Client,
  createClient
} from "../../generated/definitions/backend-session/client";

export type BackendInternalClientDependency = {
  readonly backendInternalClient: Client<"token">;
};

const httpApiFetch = agent.getFetch(process.env);
const abortableFetch = AbortableFetch(httpApiFetch);

export const buildIoBackendInternalClient = ({
  BACKEND_INTERNAL_API_KEY,
  BACKEND_INTERNAL_BASE_URL,
  FETCH_TIMEOUT_MS
}: IConfig): Client =>
  createClient<"token">({
    baseUrl: BACKEND_INTERNAL_BASE_URL.href,
    fetchApi: (toFetch(
      setFetchTimeout(FETCH_TIMEOUT_MS as Millisecond, abortableFetch)
    ) as unknown) as typeof fetch,
    // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
    withDefaults: op => params =>
      op({
        ...params,
        token: BACKEND_INTERNAL_API_KEY
      })
  });
