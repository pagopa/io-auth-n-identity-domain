import { app } from "@azure/functions";
import {
  AbortableFetch,
  setFetchTimeout,
  toFetch
} from "@pagopa/ts-commons/lib/fetch";
import { agent } from "@pagopa/ts-commons";
import { Millisecond } from "@pagopa/ts-commons/lib/units";
import { DefaultAzureCredential } from "@azure/identity";
import { BlobServiceClient } from "@azure/storage-blob";
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

// ---------------------------------------------------------------------------
// CONFIG SETUP
// ---------------------------------------------------------------------------
const config = getConfigOrThrow();
initTelemetryClient();

// ---------------------------------------------------------------------------
// DEPENDENCY INITIALISATION
// ---------------------------------------------------------------------------
const httpApiFetch = agent.getFetch(process.env);
const abortableFetch = AbortableFetch(httpApiFetch);

const fnLollipopClient: FnLollipopClient = createClient({
  baseUrl: config.LOLLIPOP_GET_ASSERTION_BASE_URL.href,
  fetchApi: toFetch(
    setFetchTimeout(config.FETCH_TIMEOUT_MS as Millisecond, abortableFetch)
  ) as unknown as typeof fetch,
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  withDefaults: op => params =>
    op({
      ...params,
      ApiKeyAuth: config.LOLLIPOP_GET_ASSERTION_API_KEY
    })
});

const auditLogContainerClient = config.USE_MANAGED_IDENTITY
  ? new BlobServiceClient(
      config.FAST_LOGIN_AUDIT_STORAGE__blobServiceUri ??
        (() => {
          throw new Error(
            "Missing FAST_LOGIN_AUDIT_STORAGE__blobServiceUri when USE_MANAGED_IDENTITY is enabled"
          );
        })(),
      new DefaultAzureCredential()
    ).getContainerClient(config.FAST_LOGIN_AUDIT_CONTAINER_NAME)
  : BlobServiceClient.fromConnectionString(
      config.FAST_LOGIN_AUDIT_CONNECTION_STRING ??
        (() => {
          throw new Error(
            "Missing FAST_LOGIN_AUDIT_CONNECTION_STRING when USE_MANAGED_IDENTITY is disabled"
          );
        })()
    ).getContainerClient(config.FAST_LOGIN_AUDIT_CONTAINER_NAME);

const sessionManagerInternalClient =
  sessionManagerInternalCreateClient<"ApiKeyAuth">({
    baseUrl: config.SESSION_MANAGER_INTERNAL_BASE_URL.href,
    fetchApi: toFetch(
      setFetchTimeout(config.FETCH_TIMEOUT_MS as Millisecond, abortableFetch)
    ) as unknown as typeof fetch,
    // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
    withDefaults: op => params =>
      op({
        ...params,
        ApiKeyAuth: config.SESSION_MANAGER_INTERNAL_API_KEY
      })
  });

const redisClientTask = CreateRedisClientSingleton(config);

// ---------------------------------------------------------------------------
// HTTP TRIGGERS
// ---------------------------------------------------------------------------
app.http("Info", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "info",
  handler: InfoFunction({ auditLogContainerClient, redisClientTask })
});

app.http("FastLogin", {
  methods: ["POST"],
  authLevel: "function",
  route: "api/v1/fast-login",
  handler: FastLoginFunction({
    auditLogContainerClient,
    fnLollipopClient,
    redisClientTask
  })
});

app.http("GenerateNonce", {
  methods: ["POST"],
  authLevel: "function",
  route: "api/v1/nonce/generate",
  handler: GenerateNonceFunction({ redisClientTask })
});

app.http("Logout", {
  methods: ["POST"],
  authLevel: "function",
  route: "api/v1/logout",
  handler: LogoutFunction({ sessionManagerInternalClient })
});

app.http("LockSession", {
  methods: ["POST"],
  authLevel: "function",
  route: "api/v1/lock-session",
  handler: LockSessionFunction({ sessionManagerInternalClient })
});

app.http("SessionState", {
  methods: ["POST"],
  authLevel: "function",
  route: "api/v1/session-state",
  handler: SessionStateFunction({ sessionManagerInternalClient })
});

app.http("UnlockSession", {
  methods: ["POST"],
  authLevel: "function",
  route: "api/v1/unlock-session",
  handler: UnlockSessionFunction({ sessionManagerInternalClient })
});
