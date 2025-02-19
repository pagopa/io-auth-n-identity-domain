import { Millisecond } from "@pagopa/ts-commons/lib/units";

import { setFetchTimeout, toFetch } from "@pagopa/ts-commons/lib/fetch";

import { agent } from "@pagopa/ts-commons";
import { AbortableFetch } from "@pagopa/ts-commons/lib/fetch";
import { IConfig } from "../../config";
import {
  Client,
  createClient
} from "../../generated/definitions/function-profile/client";

export type FunctionProfileClientDependency = {
  readonly functionProfileClient: Client<"SubscriptionKey">;
};

const httpApiFetch = agent.getFetch(process.env);
const abortableFetch = AbortableFetch(httpApiFetch);

export const buildFunctionProfileClient = ({
  FUNCTION_PROFILE_API_KEY,
  FUNCTION_PROFILE_BASE_URL,
  FETCH_TIMEOUT_MS
}: IConfig): Client =>
  createClient<"SubscriptionKey">({
    baseUrl: FUNCTION_PROFILE_BASE_URL.href,
    fetchApi: (toFetch(
      setFetchTimeout(FETCH_TIMEOUT_MS as Millisecond, abortableFetch)
    ) as unknown) as typeof fetch,
    // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
    withDefaults: op => params =>
      op({
        ...params,
        SubscriptionKey: FUNCTION_PROFILE_API_KEY
      })
  });
