import type { PackageInfo } from "@pagopa/io-package-info";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Config } from "../domain/value-objects/configs/index.js";

const mocks = vi.hoisted(() => ({
  redis: vi.fn(),
  managedRedis: vi.fn(),
  redisClose: vi.fn(),
  cosmos: vi.fn(),
  dispose: vi.fn(),
  serviceBus: vi.fn(),
  serviceBusClose: vi.fn(),
  table: vi.fn(),
  register: vi.fn(),
  close: vi.fn(),
  warn: vi.fn(),
  warmUp: vi.fn(),
  mountReserve: vi.fn(),
  mountGenerateNonce: vi.fn(),
  hooks: new Map<string, () => Promise<void>>(),
  order: [] as string[],
}));

vi.mock("fastify", () => ({
  default: () => ({
    register: mocks.register,
    addHook: (name: string, hook: () => Promise<void>) =>
      mocks.hooks.set(name, hook),
    close: mocks.close,
    log: { warn: mocks.warn },
  }),
}));
vi.mock("@azure/cosmos", () => ({ CosmosClient: mocks.cosmos }));
vi.mock("@azure/service-bus", () => ({ ServiceBusClient: mocks.serviceBus }));
vi.mock("@azure/identity", () => ({ DefaultAzureCredential: vi.fn() }));
vi.mock("@azure/data-tables", () => ({
  TableClient: Object.assign(mocks.table, {
    fromConnectionString: mocks.table,
  }),
}));
vi.mock("@azure/storage-queue", () => {
  const QueueServiceClient = Object.assign(
    vi.fn(() => ({ getQueueClient: vi.fn() })),
    { fromConnectionString: () => ({ getQueueClient: vi.fn() }) },
  );
  return { QueueServiceClient };
});
vi.mock("@pagopa/redis/node-client", () => ({
  createRedisClusterClient: mocks.redis,
  createRedisManagedIdentityClusterClient: mocks.managedRedis,
}));
vi.mock("@pagopa/redis/object-wrapper");
vi.mock("@pagopa/redis/set-wrapper");
vi.mock("@pagopa/azure-sdk/data-tables");
vi.mock("@pagopa/io-auth-n-identity-session/adapters");
vi.mock("../adapters/outbound/auth-event-service-bus.adapter.js");
vi.mock("../adapters/outbound/auxiliary-data.adapter.js");
vi.mock("../adapters/outbound/blocked-users-redis.adapter.js");
vi.mock("../adapters/outbound/in-memory-oidc-config.adapter.js");
vi.mock("../adapters/outbound/io-fast-login.adapter.js");
vi.mock("../adapters/outbound/io-lollipop.adapter.js");
vi.mock("../adapters/outbound/io-profile.adapter.js");
vi.mock("../adapters/outbound/locked-profiles-data-table.adapter.js");
vi.mock("../adapters/outbound/lollipop-revocation-queue.adapter.js");
vi.mock("../adapters/outbound/notification-storage-queue.adapter.js");
vi.mock("../adapters/outbound/one-id-identity-assertion-fetcher-adapter.js");
vi.mock("../adapters/outbound/platform-internal.adapter.js");
vi.mock("../adapters/outbound/technical-locked-profiles-data-table.adapter.js");
vi.mock("../adapters/outbound/openid-client.adapter.js", () => ({
  OpenIdClientAdapter: vi.fn(() => ({ warmUp: mocks.warmUp })),
}));
vi.mock("../middlewares/authentication/index.js");
vi.mock("../adapters/inbound/fastify/callback.handler.js");
vi.mock("../adapters/inbound/fastify/fast-login.handler.js");
vi.mock("../adapters/inbound/fastify/generate-nonce.handler.js", () => ({
  mountGenerateNonceHandler: mocks.mountGenerateNonce,
}));
vi.mock("../adapters/inbound/fastify/get-session.handler.js", () => ({
  mountGetSessionHandler: () => vi.fn(),
}));
vi.mock("../adapters/inbound/fastify/health-check.handler.js", () => ({
  mountHealthCheckHandler: () => vi.fn(),
}));
vi.mock("../adapters/inbound/fastify/reserve.handler.js", () => ({
  mountReserveHandler: mocks.mountReserve,
}));
vi.mock("../adapters/inbound/fastify/sso-bpd-user.handler.js");
vi.mock("../adapters/inbound/fastify/sso-fims-lollipop-user.handler.js");
vi.mock("../adapters/inbound/fastify/sso-fims-user.handler.js");
vi.mock("../adapters/inbound/fastify/sso-pagopa-user.handler.js");
vi.mock("../adapters/inbound/fastify/sso-zendesk-token.handler.js");

import { createApp } from "../app.js";

const createConfig = (NODE_ENV: Config["NODE_ENV"] = "development"): Config =>
  ({
    NODE_ENV,
    LOLLIPOP_API_BASE_PATH: "/",
    LOLLIPOP_API_URL: "https://lollipop.example.com",
    IO_FAST_LOGIN_API_BASE_PATH: "/",
    IO_FAST_LOGIN_API_URL: "https://fast-login.example.com",
    IO_PROFILE_API_BASE_PATH: "/",
    IO_PROFILE_API_URL: "https://profile.example.com",
    PLATFORM_PROXY_API_BASE_PATH: "/",
    PLATFORM_PROXY_API_URL: "https://platform.example.com",
  }) as unknown as Config;
const config = createConfig();
const packageInfo = { name: "test-app" } as PackageInfo;

const closeClients = () => {
  const hook = mocks.hooks.get("onClose");
  expect(hook).toBeDefined();
  return hook!();
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  mocks.hooks.clear();
  mocks.order.length = 0;
  mocks.redis.mockResolvedValue({ close: mocks.redisClose });
  mocks.managedRedis.mockResolvedValue({ close: mocks.redisClose });
  mocks.cosmos.mockImplementation(() => ({ dispose: mocks.dispose }));
  mocks.serviceBus.mockImplementation(() => ({
    close: mocks.serviceBusClose,
    createSender: vi.fn(),
  }));
  mocks.warmUp.mockResolvedValue(undefined);
  mocks.redisClose.mockImplementation(async () => {
    mocks.order.push("redis");
  });
  mocks.dispose.mockImplementation(() => {
    mocks.order.push("cosmos");
  });
  mocks.serviceBusClose.mockImplementation(async () => {
    mocks.order.push("serviceBus");
  });
  mocks.close.mockImplementation(async () => {
    mocks.order.push("fastify");
    await closeClients();
  });
  vi.spyOn(process, "exit").mockImplementation(() => {
    throw new Error("createApp must not exit the process");
  });
});

afterEach(() => {
  expect(process.exit).not.toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("createApp resource ownership", () => {
  it.each(["development", "production"] as const)(
    "closes clients once in reverse order in %s",
    async (NODE_ENV) => {
      const { server } = await createApp(createConfig(NODE_ENV), packageInfo);
      expect(mocks.mountGenerateNonce).toHaveBeenCalledExactlyOnceWith(
        server,
        expect.any(Function),
      );
      expect(
        NODE_ENV === "production" ? mocks.managedRedis : mocks.redis,
      ).toHaveBeenCalledOnce();
      expect(
        NODE_ENV === "production" ? mocks.redis : mocks.managedRedis,
      ).not.toHaveBeenCalled();
      expect(mocks.redisClose).not.toHaveBeenCalled();
      await Promise.all([closeClients(), closeClients()]);
      await server.close();
      expect(mocks.order).toEqual(["serviceBus", "cosmos", "redis", "fastify"]);
      expect(mocks.serviceBusClose).toHaveBeenCalledOnce();
      expect(mocks.dispose).toHaveBeenCalledOnce();
      expect(mocks.redisClose).toHaveBeenCalledOnce();
    },
  );

  it.each([
    ["plugin registration", mocks.register, ["fastify"]],
    ["table construction", mocks.table, ["fastify"]],
    ["Cosmos construction", mocks.cosmos, ["redis", "fastify"]],
    [
      "Service Bus construction",
      mocks.serviceBus,
      ["cosmos", "redis", "fastify"],
    ],
    [
      "route mounting",
      mocks.mountReserve,
      ["serviceBus", "cosmos", "redis", "fastify"],
    ],
  ] as const)(
    "rolls back acquired resources after %s fails",
    async (_stage, failureMock, expected) => {
      const error = new Error("initialization failed");
      failureMock.mockImplementationOnce(() => {
        throw error;
      });
      await expect(createApp(config, packageInfo)).rejects.toBe(error);
      expect(mocks.order).toEqual(expected);
    },
  );

  it("closes Fastify when Redis initialization rejects", async () => {
    const error = new Error("Redis connect failed");
    mocks.redis.mockRejectedValueOnce(error);
    await expect(createApp(config, packageInfo)).rejects.toBe(error);
    expect(mocks.order).toEqual(["fastify"]);
    expect(mocks.redisClose).not.toHaveBeenCalled();
  });

  it("continues startup when warm-up rejects and cleans up on shutdown", async () => {
    const error = new Error("warm-up failed");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    mocks.warmUp.mockRejectedValueOnce(error);
    const { server } = await createApp(config, packageInfo);
    expect(warn).toHaveBeenCalledExactlyOnceWith(
      "Failed to warm up OIDC exchange adapter:",
      error,
    );
    expect(mocks.mountReserve).toHaveBeenCalledOnce();
    expect(mocks.order).toEqual([]);
    await server.close();
    expect(mocks.order).toEqual(["fastify", "serviceBus", "cosmos", "redis"]);
  });

  it.each(["throw", "reject"] as const)(
    "continues cleanup after a Service Bus %s",
    async (failure) => {
      const error = new Error("startup failed");
      mocks.mountReserve.mockImplementationOnce(() => {
        throw error;
      });
      mocks.serviceBusClose.mockImplementationOnce(() => {
        if (failure === "throw") throw new Error("close failed");
        return Promise.reject(new Error("close failed"));
      });
      mocks.dispose.mockImplementationOnce(() => {
        throw new Error("dispose failed");
      });
      await expect(createApp(config, packageInfo)).rejects.toBe(error);
      expect(mocks.redisClose).toHaveBeenCalledOnce();
      expect(mocks.close).toHaveBeenCalledOnce();
      expect(mocks.warn).toHaveBeenCalledTimes(2);
    },
  );

  it.each(["serviceBus", "redis", "fastify"] as const)(
    "bounds a hanging %s cleanup and handles its late rejection",
    async (resource) => {
      const error = new Error("startup failed");
      let rejectClose!: (reason: Error) => void;
      const pendingClose = new Promise<void>((_resolve, reject) => {
        rejectClose = reject;
      });
      const close = {
        serviceBus: mocks.serviceBusClose,
        redis: mocks.redisClose,
        fastify: mocks.close,
      }[resource];
      close.mockReturnValueOnce(pendingClose);
      mocks.mountReserve.mockImplementationOnce(() => {
        throw error;
      });
      const result = expect(createApp(config, packageInfo)).rejects.toBe(error);

      await vi.advanceTimersByTimeAsync(1_999);
      expect(mocks.warn).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1);
      await result;

      expect(mocks.serviceBusClose).toHaveBeenCalledOnce();
      expect(mocks.dispose).toHaveBeenCalledOnce();
      expect(mocks.redisClose).toHaveBeenCalledOnce();
      expect(mocks.close).toHaveBeenCalledOnce();
      expect(mocks.warn).toHaveBeenCalledWith(
        {
          err: expect.objectContaining({
            message: expect.stringContaining("Cleanup timed out"),
          }),
        },
        expect.stringContaining("Failed to clean up"),
      );
      rejectClose(new Error("late failure"));
      await vi.advanceTimersByTimeAsync(0);
    },
  );

  it("continues normal onClose after a rejected client close", async () => {
    const { server } = await createApp(config, packageInfo);
    mocks.serviceBusClose.mockRejectedValueOnce(new Error("close failed"));
    await server.close();
    expect(mocks.dispose).toHaveBeenCalledOnce();
    expect(mocks.redisClose).toHaveBeenCalledOnce();
    expect(mocks.warn).toHaveBeenCalledOnce();
  });

  it("preserves startup failure if Fastify close throws", async () => {
    const error = new Error("startup failed");
    mocks.mountReserve.mockImplementationOnce(() => {
      throw error;
    });
    mocks.close.mockImplementationOnce(() => {
      throw new Error("Fastify close failed");
    });
    await expect(createApp(config, packageInfo)).rejects.toBe(error);
    expect(mocks.warn).toHaveBeenCalledWith(
      { err: expect.any(Error) },
      "Failed to clean up Fastify server",
    );
  });
});
