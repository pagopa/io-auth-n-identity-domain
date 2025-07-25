import {
  AbortableFetch,
  setFetchTimeout,
  toFetch
} from "@pagopa/ts-commons/lib/fetch";
import { agent } from "@pagopa/ts-commons";
import { Millisecond } from "@pagopa/ts-commons/lib/units";
import { createBlobService } from "azure-storage";
import { getConfigOrThrow } from "./config";
import { InfoFunction } from "./functions/info";
import { FastLoginFunction } from "./functions/fast-login";
import { createClient } from "./generated/definitions/fn-lollipop/client";
import { FnLollipopClient } from "./utils/lollipop/dependency";
import { createClient as sessionManagerInternalCreateClient } from "./generated/definitions/sm-internal/client";
import { LogoutFunction } from "./functions/logout";
import { LockSessionFunction } from "./functions/lock-session";
import { SessionStateFunction } from "./functions/session-state";
import { UnlockSessionFunction } from "./functions/unlock-session";
import { GenerateNonceFunction } from "./functions/generate-nonce";
import { CreateRedisClientSingleton } from "./utils/redis/client";
import { initTelemetryClient } from "./utils/appinsights";

const config = getConfigOrThrow();
initTelemetryClient();

const httpApiFetch = agent.getFetch(process.env);
const abortableFetch = AbortableFetch(httpApiFetch);

const fnLollipopClient: FnLollipopClient = createClient({
  baseUrl: config.LOLLIPOP_GET_ASSERTION_BASE_URL.href,
  fetchApi: (toFetch(
    setFetchTimeout(config.FETCH_TIMEOUT_MS as Millisecond, abortableFetch)
  ) as unknown) as typeof fetch,
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  withDefaults: op => params =>
    op({
      ...params,
      ApiKeyAuth: config.LOLLIPOP_GET_ASSERTION_API_KEY
    })
});

const blobService = createBlobService(
  config.FAST_LOGIN_AUDIT_CONNECTION_STRING
);

const sessionManagerInternalClient = sessionManagerInternalCreateClient<
  "ApiKeyAuth"
>({
  baseUrl: config.SESSION_MANAGER_INTERNAL_BASE_URL.href,
  fetchApi: (toFetch(
    setFetchTimeout(config.FETCH_TIMEOUT_MS as Millisecond, abortableFetch)
  ) as unknown) as typeof fetch,
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  withDefaults: op => params =>
    op({
      ...params,
      ApiKeyAuth: config.SESSION_MANAGER_INTERNAL_API_KEY
    })
});

const redisClientTask = CreateRedisClientSingleton(config);

export const Info = InfoFunction({ redisClientTask });
export const FastLogin = FastLoginFunction({
  blobService,
  containerName: config.FAST_LOGIN_AUDIT_CONTAINER_NAME,
  fnLollipopClient,
  redisClientTask
});
export const Logout = LogoutFunction({ sessionManagerInternalClient });
export const LockSession = LockSessionFunction({
  sessionManagerInternalClient
});
export const SessionState = SessionStateFunction({
  sessionManagerInternalClient
});
export const UnlockSession = UnlockSessionFunction({
  sessionManagerInternalClient
});
export const GenerateNonce = GenerateNonceFunction({ redisClientTask });
