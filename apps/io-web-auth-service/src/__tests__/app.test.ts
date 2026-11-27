import { DefaultAzureCredential } from "@azure/identity";
import { createPackageInfoAdapter } from "@pagopa/io-package-info";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { type Config } from "../domain/value-objects/configs/index.js";
import { generateKeyPairSync } from "node:crypto";
import { NonEmptyString } from "@pagopa/hexagonal-core";

const mocks = vi.hoisted(() => ({
  redis: vi.fn(),
  managedRedis: vi.fn(),
  redisClose: vi.fn(),
  redisPing: vi.fn(),
  warmUp: vi.fn(),
}));

vi.mock("@azure/identity", () => ({ DefaultAzureCredential: vi.fn() }));
vi.mock("@pagopa/redis/node-client", () => ({
  createRedisClusterClient: mocks.redis,
  createRedisManagedIdentityClusterClient: mocks.managedRedis,
}));
vi.mock("../adapters/outbound/openid-client.adapter.js", () => ({
  OpenIdClientAdapter: vi.fn(() => ({ warmUp: mocks.warmUp })),
}));

import { createApp } from "../app.js";
import { ConfigSchema } from "../domain/value-objects/configs/index.js";

const createConfig = (NODE_ENV: Config["NODE_ENV"] = "development"): Config =>
  ConfigSchema.parse({
    HOST: "127.0.0.1",
    PORT: "3000",
    NODE_ENV,
    ONEID_PROD_CLIENT_ID: "a-client-id",
    ONEID_PROD_CLIENT_SECRET: "a-client-secret",
    ONEID_PROD_ISSUER: "https://oneid.pagopa.it",
    ONEID_PROD_REDIRECT_URI:
      "https://api-web.io.pagopa.it/ioweb/auth/v2/callback",
    REDIS_HOSTNAME: "localhost",

    JWT_TOKEN_PRIVATE_KEY: generateKeyPairSync("rsa", {
      modulusLength: 2048,
    }).privateKey.export({ type: "pkcs8", format: "pem" }) as NonEmptyString,
    JWT_TOKEN_ISSUER: "io-web-auth-service",
    JWT_TOKEN_TTL_SECONDS: 3600,
    LOGIN_SUCCESS_REDIRECT_URL: "http://localhost:3000/success",
    LOGIN_ERROR_REDIRECT_URL: "http://localhost:3000/error",
  });
const config = createConfig();
const packageInfo = createPackageInfoAdapter(
  fileURLToPath(new URL("../../package.json", import.meta.url)),
)
  .load()
  ._unsafeUnwrap();

beforeEach(() => {
  vi.clearAllMocks();
  const redisClient = { close: mocks.redisClose, ping: mocks.redisPing };
  mocks.redis.mockResolvedValue(redisClient);
  mocks.managedRedis.mockResolvedValue(redisClient);
  mocks.redisPing.mockResolvedValue("PONG");
  mocks.warmUp.mockResolvedValue(undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "info").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("createApp", () => {
  it("trusts the forwarded client IP", async () => {
    const { server } = await createApp(config, packageInfo);
    server.get("/client-ip", async (request) => ({ ip: request.ip }));

    try {
      const response = await server.inject({
        method: "GET",
        url: "/client-ip",
        headers: { "x-forwarded-for": "203.0.113.1" },
      });

      expect(response.json()).toEqual({ ip: "203.0.113.1" });
    } finally {
      await server.close();
    }
  });

  it.each([
    ["development", mocks.redis, mocks.managedRedis],
    ["production", mocks.managedRedis, mocks.redis],
  ] as const)(
    "creates the %s Redis client and closes it on shutdown",
    async (NODE_ENV, expectedFactory, unexpectedFactory) => {
      const { server } = await createApp(createConfig(NODE_ENV), packageInfo);

      expect(expectedFactory).toHaveBeenCalledOnce();
      expect(unexpectedFactory).not.toHaveBeenCalled();
      expect(mocks.redisClose).not.toHaveBeenCalled();
      if (NODE_ENV === "production") {
        expect(DefaultAzureCredential).toHaveBeenCalledOnce();
        expect(mocks.managedRedis).toHaveBeenCalledWith(
          expect.any(Object),
          vi.mocked(DefaultAzureCredential).mock.instances[0],
          expect.any(Function),
        );
      } else {
        expect(DefaultAzureCredential).not.toHaveBeenCalled();
        expect(mocks.redis).toHaveBeenCalledWith(
          expect.any(Object),
          expect.any(Function),
        );
      }

      await server.close();

      expect(mocks.redisClose).toHaveBeenCalledOnce();
    },
  );

  it("logs Redis cleanup failures without failing shutdown", async () => {
    vi.stubEnv("APPLICATIONINSIGHTS_CONNECTION_STRING", "");
    mocks.redisClose.mockRejectedValueOnce(new Error("Redis close failed"));
    const { server } = await createApp(config, packageInfo);

    await server.close();

    expect(console.error).toHaveBeenCalledWith(
      "Failed to clean up Redis client",
      expect.objectContaining({ error: "Redis close failed" }),
    );
  });

  it("fails startup when the Redis client cannot be created", async () => {
    const error = new Error("Redis connect failed");
    mocks.redis.mockRejectedValueOnce(error);

    await expect(createApp(config, packageInfo)).rejects.toBe(error);
  });

  it("continues startup when the OIDC warm-up fails", async () => {
    mocks.warmUp.mockRejectedValueOnce(new Error("warm-up failed"));

    const { server } = await createApp(config, packageInfo);

    expect(mocks.warmUp).toHaveBeenCalledExactlyOnceWith(
      new Set(["PROD", "UAT"]),
    );
    await server.close();
  });

  it.each([
    ["PONG", 200],
    ["NOT-PONG", 500],
  ])(
    "includes Redis in the readiness check (PING reply %s → %i)",
    async (reply, status) => {
      mocks.redisPing.mockResolvedValue(reply);
      const { server } = await createApp(config, packageInfo);

      try {
        const readiness = await server.inject({
          method: "GET",
          url: "/health/readiness",
        });
        const liveness = await server.inject({
          method: "GET",
          url: "/health/liveness",
        });

        expect(readiness.statusCode).toBe(status);
        expect(liveness.statusCode).toBe(200);
      } finally {
        await server.close();
      }
    },
  );
});
