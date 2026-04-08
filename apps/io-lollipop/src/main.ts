import { app } from "@azure/functions";
import { BlobServiceClient } from "@azure/storage-blob";

import {
  LolliPOPKeysModel,
  LOLLIPOPKEYS_COLLECTION_NAME,
} from "./model/lollipop_keys";
import { cosmosdbInstance } from "./utils/cosmosdb";
import { getConfigOrThrow } from "./utils/config";
import { initTelemetryClient } from "./utils/appinsights";
import {
  getPublicKeyDocumentReader,
  getAssertionReader,
} from "./utils/readers";
import { getAssertionWriter, getPopDocumentWriter } from "./utils/writers";
import { getGenerateAuthJWT } from "./utils/auth_jwt";
import { MASTER_HASH_ALGO } from "./utils/lollipopKeys";
import { createApplicationInsightsLogger } from "./utils/logging";
import { createClient as externalClient } from "./generated/definitions/external/client";
import { handleRevoke } from "./HandlePubKeyRevoke/handler";
import { MAX_DEQUEUE_COUNT } from "./hostConfig";

import { Info } from "./Info/handler";
import { ActivatePubKey } from "./ActivatePubKey/handler";
import { getSignedMessageHandler } from "./FirstLollipopConsumerSignedMessage/handler";
import { GenerateLCParams } from "./GenerateLCParams/handler";
import { GetAssertion } from "./GetAssertion/handler";
import { getReservePubKeyHandler } from "./ReservePubKey/handler";

// ---------------------------------------------------------------------------
// CONFIG SETUP
// ---------------------------------------------------------------------------

const config = getConfigOrThrow();

// ---------------------------------------------------------------------------
// TELEMETRY & LOGGING
// ---------------------------------------------------------------------------

const telemetryClient = initTelemetryClient(
  config.APPLICATIONINSIGHTS_CONNECTION_STRING,
);

const eventLogger = createApplicationInsightsLogger(
  telemetryClient,
  "lollipop",
);
// Change the default logger if needed (e.g. with a InvocationContext logger)
const defaultLogger = eventLogger;

// ---------------------------------------------------------------------------
// DEPENDENCY INITIALISATION
// ---------------------------------------------------------------------------

const lollipopKeysModel = new LolliPOPKeysModel(
  cosmosdbInstance.container(LOLLIPOPKEYS_COLLECTION_NAME),
);

const assertionBlobService = BlobServiceClient.fromConnectionString(
  config.LOLLIPOP_ASSERTION_STORAGE_CONNECTION_STRING,
);

const assertionBlobServiceFallback = BlobServiceClient.fromConnectionString(
  config.LOLLIPOP_ASSERTION_STORAGE_FALLBACK_CONNECTION_STRING,
);

const assertionClient = externalClient<"ApiKeyAuth">({
  baseUrl: config.FIRST_LC_ASSERTION_CLIENT_BASE_URL,
  fetchApi: fetch,
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  withDefaults: (op) => (params) =>
    op({
      ...params,
      ApiKeyAuth: config.FIRST_LC_ASSERTION_CLIENT_SUBSCRIPTION_KEY,
    }),
});

// ---------------------------------------------------------------------------
// MOUNT HTTP HANDLERS
// ---------------------------------------------------------------------------

app.http("Info", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "info",
  handler: Info(),
});

app.http("ReservePubKey", {
  methods: ["POST"],
  authLevel: "function",
  route: "api/v1/pubkeys",
  handler: getReservePubKeyHandler(lollipopKeysModel, eventLogger),
});

app.http("ActivatePubKey", {
  methods: ["PUT"],
  authLevel: "function",
  route: "api/v1/pubKeys/{assertion_ref}",
  handler: ActivatePubKey(
    getPublicKeyDocumentReader(lollipopKeysModel),
    getPopDocumentWriter(lollipopKeysModel),
    getAssertionWriter(
      assertionBlobService,
      config.LOLLIPOP_ASSERTION_STORAGE_CONTAINER_NAME,
    ),
    eventLogger,
  ),
});

app.http("GenerateLCParams", {
  methods: ["POST"],
  authLevel: "function",
  route: "api/v1/pubKeys/{assertion_ref}/generate",
  handler: GenerateLCParams(
    getPublicKeyDocumentReader(lollipopKeysModel),
    config.KEYS_EXPIRE_GRACE_PERIODS_IN_DAYS,
    getGenerateAuthJWT(config),
    defaultLogger,
    eventLogger,
  ),
});

app.http("GetAssertion", {
  methods: ["GET"],
  authLevel: "function",
  route: "api/v1/assertions/{assertion_ref}",
  handler: GetAssertion(
    config,
    getPublicKeyDocumentReader(lollipopKeysModel),
    getAssertionReader(
      assertionBlobService,
      config.LOLLIPOP_ASSERTION_STORAGE_CONTAINER_NAME,
      assertionBlobServiceFallback,
      config.LOLLIPOP_ASSERTION_STORAGE_FALLBACK_CONTAINER_NAME,
    ),
    defaultLogger,
    eventLogger,
  ),
});

app.http("FirstLollipopConsumerSignedMessage", {
  methods: ["POST"],
  authLevel: "function",
  route: "api/v1/first-lollipop-consumer/signed-message",
  handler: getSignedMessageHandler(assertionClient, config),
});

// ---------------------------------------------------------------------------
// QUEUE TRIGGERS
// ---------------------------------------------------------------------------

app.storageQueue("HandlePubKeyRevoke", {
  connection: "SESSION_STORAGE_CONNECTION_STRING",
  queueName: "%LOLLIPOP_ASSERTION_REVOKE_QUEUE%",
  handler: (rawRevokeMessage, context) =>
    handleRevoke(
      context,
      telemetryClient,
      lollipopKeysModel,
      MASTER_HASH_ALGO,
      MAX_DEQUEUE_COUNT,
      rawRevokeMessage,
    ),
});
