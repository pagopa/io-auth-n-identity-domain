import type { PackageInfo } from "@pagopa/io-package-info";
import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";

import { mountHealthCheckHandler } from "../adapters/inbound/fastify/health-check.handler.js";
import { createApp } from "../app.js";
import { ConfigSchema } from "../domain/value-objects/configs/index.js";

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

const config = ConfigSchema.parse({});
const packageInfo: PackageInfo = {
  name: "io-session-manager-internal-oi",
  version: "0.0.0",
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createApp", () => {
  it.each(["liveness", "readiness"])(
    "mounts %s without outbound adapters",
    async (type) => {
      const { server } = await createApp(config, packageInfo);
      try {
        expect(server.server.listening).toBe(false);
        const response = await server.inject({
          method: "GET",
          url: `/api/auth/v2/health/${type}`,
        });
        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual(packageInfo);
      } finally {
        await server.close();
      }
    },
  );

  it("leaves business routes unmounted", async () => {
    const { server } = await createApp(config, packageInfo);
    try {
      const response = await server.inject({ method: "GET", url: "/" });
      expect(response.statusCode).toBe(404);
    } finally {
      await server.close();
    }
  });

  it("allows repeated shutdown without repeating close hooks", async () => {
    const { server } = await createApp(config, packageInfo);
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

    await expect(createApp(config, packageInfo)).rejects.toBe(startupError);

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
      await expect(createApp(config, packageInfo)).rejects.toBe(startupError);
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
    vi.mocked(mountHealthCheckHandler).mockImplementationOnce(
      () => (server) => {
        captured.server = server;
        vi.spyOn(server.log, "warn");
        vi.spyOn(server, "close").mockImplementationOnce(
          () => new Promise<void>(() => {}),
        );
        throw startupError;
      },
    );

    try {
      const outcome = expect(createApp(config, packageInfo)).rejects.toBe(
        startupError,
      );
      await vi.advanceTimersByTimeAsync(1999);
      expect(captured.server?.log.warn).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1);
      await outcome;
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
      await captured.server?.close();
    }
  });
});
