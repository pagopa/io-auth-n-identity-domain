import { app } from "@azure/functions";
import { DefaultAzureCredential } from "@azure/identity";
import { BlobServiceClient } from "@azure/storage-blob";

import { getConfigOrThrow } from "./utils/config";
import { initTelemetryClient } from "./utils/appinsights";
import { getFastLoginClient } from "./clients/fastLoginClient";
import { getFunctionsAppClient } from "./clients/functionsAppClient";
import { getExchangeHandler } from "./Exchange/handler";
import { Info } from "./Info/handler";
import { getLockSessionHandler } from "./LockSession/handler";
import { getLogoutHandler } from "./Logout/handler";
import { getMagicLinkHandler } from "./MagicLink/handler";
import { getProfileHandler } from "./Profile/handler";
import { getSessionStateHandler } from "./SessionState/handler";
import { getUnlockSessionHandler } from "./UnlockSession/handler";

// ---------------------------------------------------------------------------
// CONFIG SETUP
// ---------------------------------------------------------------------------
const config = getConfigOrThrow();
initTelemetryClient();

// ---------------------------------------------------------------------------
// DEPENDENCY INITIALISATION
// ---------------------------------------------------------------------------
const containerClient = config.USE_MANAGED_IDENTITY
  ? new BlobServiceClient(
      config.AUDIT_LOG_STORAGE__blobServiceUri ??
        (() => {
          throw new Error(
            "Missing AUDIT_LOG_STORAGE__blobServiceUri when USE_MANAGED_IDENTITY is enabled"
          );
        })(),
      new DefaultAzureCredential()
    ).getContainerClient(config.AUDIT_LOG_CONTAINER)
  : BlobServiceClient.fromConnectionString(
      config.AUDIT_LOG_CONNECTION_STRING ??
        (() => {
          throw new Error(
            "Missing AUDIT_LOG_CONNECTION_STRING when USE_MANAGED_IDENTITY is disabled"
          );
        })()
    ).getContainerClient(config.AUDIT_LOG_CONTAINER);

const fastLoginClient = getFastLoginClient(
  config.FAST_LOGIN_API_KEY,
  config.FAST_LOGIN_CLIENT_BASE_URL
);

const functionsAppClient = getFunctionsAppClient(
  config.FUNCTIONS_APP_API_KEY,
  config.FUNCTIONS_APP_CLIENT_BASE_URL
);

// ---------------------------------------------------------------------------
// HTTP TRIGGERS
// ---------------------------------------------------------------------------
app.http("Info", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "api/v1/info",
  handler: Info(containerClient)
});

app.http("Exchange", {
  methods: ["POST"],
  authLevel: "function",
  route: "api/v1/exchange",
  handler: getExchangeHandler(config, containerClient)
});

app.http("LockSession", {
  methods: ["POST"],
  authLevel: "function",
  route: "api/v1/lock-session",
  handler: getLockSessionHandler(fastLoginClient, config, containerClient)
});

app.http("Logout", {
  methods: ["POST"],
  authLevel: "function",
  route: "api/v1/logout",
  handler: getLogoutHandler(fastLoginClient, config, containerClient)
});

app.http("MagicLink", {
  methods: ["POST"],
  authLevel: "function",
  route: "api/v1/magic-link",
  handler: getMagicLinkHandler(
    config.MAGIC_LINK_JWE_ISSUER,
    config.MAGIC_LINK_JWE_PRIMARY_PUB_KEY,
    config.MAGIC_LINK_JWE_TTL,
    config.MAGIC_LINK_BASE_URL,
    containerClient
  )
});

app.http("Profile", {
  methods: ["GET"],
  authLevel: "function",
  route: "api/v1/profile",
  handler: getProfileHandler(functionsAppClient, config)
});

app.http("SessionState", {
  methods: ["GET"],
  authLevel: "function",
  route: "api/v1/session-state",
  handler: getSessionStateHandler(fastLoginClient, config)
});

app.http("UnlockSession", {
  methods: ["POST"],
  authLevel: "function",
  route: "api/v1/unlock-session",
  handler: getUnlockSessionHandler(fastLoginClient, config, containerClient)
});
