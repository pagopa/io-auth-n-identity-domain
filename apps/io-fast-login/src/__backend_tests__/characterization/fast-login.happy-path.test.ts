import { afterAll, beforeAll, describe, expect } from "vitest";
import type { ScenarioCassette } from "../support/cassettes";
import {
  readScenarioCassette,
  writeScenarioCassette
} from "../support/cassettes";
import {
  buildFastLoginSamlResponse,
  fastLoginFixture,
  fastLoginScenarioName,
  functionsMasterKey,
  lollipopApiKey
} from "../support/fixtures";
import { FunctionHost } from "../support/function-host";
import { LollipopStub } from "../support/lollipop-stub";
import { backendTest } from "../support/with-test-fixtures";
import { callFastLogin, fastLoginExpectedStubPath } from "../support/scenarios";

const recordMode = process.env.IO_FAST_LOGIN_CHARACTERIZATION_MODE ?? "verify";

const normalizeBlobName = (value: string): string =>
  value
    .replace(/\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}/, "<TIMESTAMP>")
    .replace(/-[0-9a-f]{6}$/i, "-<RANDOM_SUFFIX>");

const normalizeAuditBlobBody = (value: string): unknown => {
  const parsed = JSON.parse(value) as Record<string, unknown>;
  const lollipopRequest = parsed.lollipop_request as Record<string, unknown>;
  const headers = lollipopRequest.headers as Record<string, string>;

  return {
    ...parsed,
    created_at: "<ISO_TIMESTAMP>",
    lollipop_request: {
      ...lollipopRequest,
      headers: {
        ...headers,
        "x-pagopa-lollipop-auth-jwt": "<REDACTED_JWT>"
      }
    }
  };
};

const normalizeScenario = (input: {
  readonly auditBlobs: ReadonlyArray<{ body: string; name: string }>;
  readonly request: {
    readonly body?: unknown;
    readonly headers: Record<string, string>;
    readonly method: string;
    readonly path: string;
  };
  readonly responseBody: unknown;
  readonly responseStatus: number;
  readonly stubRequests: ReadonlyArray<{
    readonly headers: Record<string, string>;
    readonly method: string;
    readonly path: string;
  }>;
}): ScenarioCassette => ({
  normalization: {
    auditBlobCreatedAt: "<ISO_TIMESTAMP>",
    auditBlobFileNameRandomSuffix: "<RANDOM_SUFFIX>",
    auditBlobFileNameTimestamp: "<TIMESTAMP>",
    functionBaseUrl: "<FUNCTION_BASE_URL>",
    functionKey: "<REDACTED_FUNCTION_KEY>",
    lollipopApiKey: "<REDACTED_API_KEY>",
    lollipopAuthJwt: "<REDACTED_JWT>"
  },
  request: {
    body: input.request.body ?? null,
    headers: {
      ...input.request.headers,
      "x-functions-key": "<REDACTED_FUNCTION_KEY>",
      "x-pagopa-lollipop-auth-jwt": "<REDACTED_JWT>"
    },
    method: input.request.method,
    path: input.request.path
  },
  response: {
    body: input.responseBody,
    status: input.responseStatus
  },
  sideEffects: {
    auditBlobs: input.auditBlobs.map(blob => ({
      body: normalizeAuditBlobBody(blob.body),
      name: normalizeBlobName(blob.name)
    })),
    lollipopRequests: input.stubRequests.map(request => ({
      headers: {
        "ocp-apim-subscription-key": "<REDACTED_API_KEY>",
        "x-pagopa-lollipop-auth": "Bearer <REDACTED_JWT>"
      },
      method: request.method,
      path: request.path
    })),
    redisKeysContainingNonce: []
  },
  topology: {
    auditContainer: "logs",
    dependencies: [
      "redis:testcontainers",
      "azurite:testcontainers",
      "lollipop-stub:local-http"
    ],
    functionBaseUrl: "<FUNCTION_BASE_URL>",
    functionKeySource: "files-secret-storage",
    runtime: "func-start"
  }
});

describe("backend characterization | fast-login", () => {
  const lollipopStub = new LollipopStub(buildFastLoginSamlResponse());
  let host!: FunctionHost;

  beforeAll(async () => {
    await lollipopStub.start();
    host = new FunctionHost({
      lollipopBaseUrl: lollipopStub.baseUrl
    });
    await host.start();
  }, 60_000);

  afterAll(async () => {
    await host.stop();
    await lollipopStub.stop();
  });

  backendTest(
    "records and verifies the live fast-login happy path through the real host",
    async ({ backend }) => {
      await backend.seedFastLoginNonce(fastLoginFixture.nonce);

      const response = await callFastLogin(host);
      const auditBlobs = await backend.readAuditBlobs();

      const liveCassette = normalizeScenario({
        auditBlobs,
        request: response.request,
        responseBody: response.body,
        responseStatus: response.status,
        stubRequests: lollipopStub.recordedRequests
      });

      if (recordMode === "record") {
        expect(response.status).toBe(200);
        expect(response.body).toEqual({
          saml_response: buildFastLoginSamlResponse()
        });
        expect(await backend.findRedisKeysContaining(fastLoginFixture.nonce)).toEqual(
          []
        );
        expect(lollipopStub.recordedRequests).toEqual([
          expect.objectContaining({
            method: "GET",
            path: fastLoginExpectedStubPath
          })
        ]);

        await writeScenarioCassette(fastLoginScenarioName, liveCassette, [
          functionsMasterKey,
          fastLoginFixture.lollipopAuthJwt,
          lollipopApiKey
        ]);
        return;
      }

      const cassette = await readScenarioCassette(fastLoginScenarioName);
      expect(liveCassette).toEqual(cassette);
    }
  );
});
