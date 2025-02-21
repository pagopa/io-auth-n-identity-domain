import { agent } from "@pagopa/ts-commons";
import {
  AbortableFetch,
  setFetchTimeout,
  toFetch
} from "@pagopa/ts-commons/lib/fetch";
import { Millisecond } from "@pagopa/ts-commons/lib/units";
import { IConfig } from "../config";

const httpApiFetch = agent.getFetch(process.env);
const abortableFetch = AbortableFetch(httpApiFetch);

export const getFetchApi = (config: IConfig) =>
  toFetch(
    setFetchTimeout(config.FETCH_TIMEOUT_MS as Millisecond, abortableFetch)
  );
