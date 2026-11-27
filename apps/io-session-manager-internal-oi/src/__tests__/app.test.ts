import type { Logger } from "@pagopa/hexagonal-core/domain/ports";
import {
  FiscalCodeSchema,
  GenericError,
  NotFoundError,
} from "@pagopa/hexagonal-core";
import {
  LollipopActivationCosmosAdapter,
  SessionCosmosAdapter,
  SessionIdSchema,
} from "@pagopa/io-auth-n-identity-session";
import type { PackageInfo } from "@pagopa/io-package-info";
import type { FastifyInstance } from "fastify";
import {
  AuthEventServiceBusAdapter,
  LockedProfilesDataTableAdapter,
  LollipopRevocationQueueAdapter,
  NotificationStorageQueueAdapter,
  TechnicalLockedProfilesDataTableAdapter,
} from "@pagopa/io-session-manager-core";
import { err, ok } from "neverthrow";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { mountHealthCheckHandler } from "../adapters/inbound/fastify/health-check.handler.js";
import { createApp } from "../app.js";
import { ConfigSchema } from "../domain/value-objects/configs/index.js";

const fiscalCode = FiscalCodeSchema.parse("ISPXNB32R82Y766D");

vi.mock(
  "../adapters/inbound/fastify/health-check.handler.js",
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import("../adapters/inbound/fastify/health-check.handler.js")
      >();
    return {
      mountHealthCheckHandler: vi.fn(actual.mountHealthCheckHandler),
    };
  },
);

const config = ConfigSchema.parse({
  HOST: "0.0.0.0",
  PORT: "8080",
  NODE_ENV: "development",
  PLATFORM_PROXY_API_URL: "http://localhost:3009",
  PLATFORM_PROXY_API_BASE_PATH: "/api/platform-internal/v1",
  AUTH_SESSIONS_TOPIC_NAME: "auth-sessions",
  SERVICE_BUS_CONNECTION_STRING:
    "Endpoint=sb://localhost/;SharedAccessKeyName=Root;SharedAccessKey=key",
  COSMOSDB_NAME: "io-auth-SM",
  COSMOSDB_CONNECTION_STRING:
    "AccountEndpoint=https://localhost:8081/;AccountKey=Zm9v;",
  COSMOSDB_SESSION_TOKEN_CONTAINER_NAME: "session-tokens",
  COSMOSDB_ACTIVE_SESSION_CONTAINER_NAME: "active-sessions",
  COSMOSDB_LOLLIPOP_ACTIVATION_CONTAINER_NAME: "lollipop-activations",
  LOLLIPOP_REVOCATION_QUEUE_NAME: "pubkeys-revoke",
  LOLLIPOP_REVOCATION_QUEUE_STORAGE_CONNECTION_STRING:
    "UseDevelopmentStorage=true",
  LOCKED_PROFILES_TABLE_NAME: "locked-profiles",
  LOCKED_PROFILES_STORAGE_CONNECTION_STRING: "UseDevelopmentStorage=true",
  PUSH_NOTIFICATIONS_QUEUE_NAME: "push-notifications",
  PUSH_NOTIFICATIONS_STORAGE_CONNECTION_STRING: "UseDevelopmentStorage=true",
  TECHNICAL_LOCKED_PROFILES_TABLE_NAME: "technical-locked-profiles",
  TECHNICAL_LOCKED_PROFILES_STORAGE_CONNECTION_STRING:
    "UseDevelopmentStorage=true",
});
const packageInfo: PackageInfo = {
  name: "io-session-manager-internal-oi",
  version: "0.0.0",
};

const logger = { trackEvent: vi.fn() } as unknown as Logger;
const createTestApp = () => createApp(config, packageInfo, logger);

afterEach(() => {
  vi.restoreAllMocks();
});

beforeEach(() => {
  vi.spyOn(
    SessionCosmosAdapter.prototype,
    "findActiveSession",
  ).mockResolvedValue(
    err(new NotFoundError("ActiveSession", "ActiveSession not found")),
  );
});

describe("createApp", () => {
  it("mounts liveness without checking outbound adapters", async () => {
    const { server } = await createTestApp();
    try {
      const response = await server.inject({
        method: "GET",
        url: "/api/auth/v2/health/liveness",
      });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual(packageInfo);
    } finally {
      await server.close();
    }
  });

  it.each([
    { queueResult: ok(undefined), statusCode: 200 },
    { queueResult: err(new GenericError("queue down")), statusCode: 500 },
  ])(
    "mounts readiness checking outbound adapters ($statusCode)",
    async ({ queueResult, statusCode }) => {
      for (const adapter of [
        LockedProfilesDataTableAdapter,
        TechnicalLockedProfilesDataTableAdapter,
        AuthEventServiceBusAdapter,
        SessionCosmosAdapter,
        LollipopActivationCosmosAdapter,
        NotificationStorageQueueAdapter,
      ]) {
        vi.spyOn(adapter.prototype, "healthcheck").mockResolvedValue(
          ok(undefined),
        );
      }
      vi.spyOn(
        LollipopRevocationQueueAdapter.prototype,
        "healthcheck",
      ).mockResolvedValue(queueResult);
      const { server } = await createTestApp();
      try {
        const response = await server.inject({
          method: "GET",
          url: "/api/auth/v2/health/readiness",
        });
        expect(response.statusCode).toBe(statusCode);
      } finally {
        await server.close();
      }
    },
  );

  it("mounts the technical lock routes and validates fiscal codes", async () => {
    const { server } = await createTestApp();
    try {
      const lockResponse = await server.inject({
        method: "POST",
        url: "/api/auth/v2/sessions/invalid/lock",
      });
      const unlockResponse = await server.inject({
        method: "DELETE",
        url: "/api/auth/v2/sessions/invalid/lock",
      });

      expect(lockResponse.statusCode).toBe(400);
      expect(unlockResponse.statusCode).toBe(400);
    } finally {
      await server.close();
    }
  });

  it("returns only the active flag for a valid fiscal code", async () => {
    vi.mocked(
      SessionCosmosAdapter.prototype.findActiveSession,
    ).mockResolvedValue(
      ok({
        fiscalCode,
        loginType: "LV",
        sessionId: SessionIdSchema.parse("test-session-id"),
        createdAt: new Date("2025-01-01T00:00:00.000Z"),
        expirationDate: new Date(Date.now() + 60_000),
        _rid: "rid",
        _ts: 1,
        _self: "self",
        _etag: "etag",
      }),
    );
    const { server } = await createTestApp();
    try {
      const response = await server.inject({
        method: "GET",
        url: `/api/auth/v2/sessions/${fiscalCode}`,
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ active: true });
    } finally {
      await server.close();
    }
  });

  it("returns active false when there is no session", async () => {
    const { server } = await createTestApp();
    try {
      const response = await server.inject({
        method: "GET",
        url: `/api/auth/v2/sessions/${fiscalCode}`,
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ active: false });
    } finally {
      await server.close();
    }
  });

  it("returns 400 for an invalid fiscal code", async () => {
    const { server } = await createTestApp();
    try {
      const response = await server.inject({
        method: "GET",
        url: "/api/auth/v2/sessions/invalid",
      });

      expect(response.statusCode).toBe(400);
    } finally {
      await server.close();
    }
  });

  it("returns 404 when the fiscal code is missing", async () => {
    const { server } = await createTestApp();
    try {
      const response = await server.inject({
        method: "GET",
        url: "/api/auth/v2/sessions",
      });

      expect(response.statusCode).toBe(404);
    } finally {
      await server.close();
    }
  });

  it("returns 500 when reading the session fails", async () => {
    vi.mocked(
      SessionCosmosAdapter.prototype.findActiveSession,
    ).mockResolvedValue(err(new GenericError("Cosmos unavailable")));
    const { server } = await createTestApp();
    try {
      const response = await server.inject({
        method: "GET",
        url: `/api/auth/v2/sessions/${fiscalCode}`,
      });

      expect(response.statusCode).toBe(500);
    } finally {
      await server.close();
    }
  });

  it("allows repeated shutdown without repeating close hooks", async () => {
    const { server } = await createTestApp();
    const onClose = vi.fn().mockResolvedValue(undefined);
    server.addHook("onClose", () => onClose());

    await server.ready();
    await Promise.all([server.close(), server.close()]);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes the server on startup failure and preserves the original error", async () => {
    const startupError = new Error("Failed to mount health checks");
    const captured: { server?: FastifyInstance } = {};
    const onClose = vi.fn().mockResolvedValue(undefined);
    vi.mocked(mountHealthCheckHandler).mockImplementationOnce(
      () => (server) => {
        captured.server = server;
        vi.spyOn(server, "close");
        server.addHook("onClose", () => onClose());
        throw startupError;
      },
    );

    await expect(createTestApp()).rejects.toBe(startupError);

    expect(captured.server?.close).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("logs server cleanup errors without masking the startup failure", async () => {
    const startupError = new Error("Failed to mount health checks");
    const cleanupError = new Error("Failed to close server");
    const captured: { server?: FastifyInstance } = {};
    vi.mocked(mountHealthCheckHandler).mockImplementationOnce(
      () => (server) => {
        captured.server = server;
        vi.spyOn(server.log, "warn");
        vi.spyOn(server, "close").mockRejectedValueOnce(cleanupError);
        throw startupError;
      },
    );

    try {
      await expect(createTestApp()).rejects.toBe(startupError);
      expect(captured.server?.log.warn).toHaveBeenCalledWith(
        { err: cleanupError },
        "Failed to clean up Fastify server",
      );
    } finally {
      await captured.server?.close();
    }
  });

  it("stops waiting for server cleanup after two seconds", async () => {
    vi.useFakeTimers();
    const startupError = new Error("Failed to mount health checks");
    const captured: { server?: FastifyInstance } = {};
    let finishClose: (() => void) | undefined;
    vi.mocked(mountHealthCheckHandler).mockImplementationOnce(
      () => (server) => {
        captured.server = server;
        vi.spyOn(server.log, "warn");
        server.addHook(
          "onClose",
          () =>
            new Promise<void>((resolve) => {
              finishClose = resolve;
            }),
        );
        throw startupError;
      },
    );

    try {
      const outcome = createTestApp().then(
        () => undefined,
        (error: unknown) => error,
      );
      await vi.advanceTimersByTimeAsync(1999);
      expect(captured.server?.log.warn).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1);
      await expect(outcome).resolves.toBe(startupError);
      expect(captured.server?.log.warn).toHaveBeenCalledWith(
        {
          err: expect.objectContaining({
            message: "Cleanup timed out for Fastify server",
          }),
        },
        "Failed to clean up Fastify server",
      );
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
      finishClose?.();
      await captured.server?.close();
    }
  });
});
