import { beforeEach, describe, expect, it, vi } from "vitest";

const { createCluster } = vi.hoisted(() => ({
  createCluster: vi.fn(),
}));

vi.mock("redis", () => ({ createCluster }));

import { createRedisClusterClient } from "../factory.js";

const buildFakeClient = () => ({
  connect: vi.fn().mockResolvedValue(undefined),
});

const lastCreateClusterOptions = () => {
  const call = createCluster.mock.calls.at(-1);
  if (!call) throw new Error("createCluster was not called");
  return call[0];
};

beforeEach(() => {
  vi.clearAllMocks();
  createCluster.mockImplementation(buildFakeClient);
});

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

describe("createRedisClusterClient — defaults", () => {
  it("uses rediss://, port 6380, useReplicas=true by default", async () => {
    await createRedisClusterClient({ url: "cache.example.com" });

    const opts = lastCreateClusterOptions();
    expect(opts.rootNodes).toEqual([
      { url: "rediss://cache.example.com:6380" },
    ]);
    expect(opts.useReplicas).toBe(true);
    expect(opts.defaults?.socket).toMatchObject({ tls: true, keepAlive: 2000 });
    expect(opts.defaults?.pingInterval).toBe(1000 * 60 * 9);
  });

  it("switches to redis:// port 6379 when enableTls is false", async () => {
    await createRedisClusterClient({
      url: "localhost",
      enableTls: false,
    });

    const opts = lastCreateClusterOptions();
    expect(opts.rootNodes).toEqual([{ url: "redis://localhost:6379" }]);
    expect(opts.defaults?.socket).toMatchObject({ tls: false });
  });

  it("honours an explicit port and useReplicas=false (SAFE client)", async () => {
    await createRedisClusterClient({
      url: "cache.example.com",
      port: 7000,
      useReplicas: false,
    });

    const opts = lastCreateClusterOptions();
    expect(opts.rootNodes).toEqual([
      { url: "rediss://cache.example.com:7000" },
    ]);
    expect(opts.useReplicas).toBe(false);
  });

  it("forwards the password into defaults", async () => {
    await createRedisClusterClient({
      url: "cache.example.com",
      password: "secret",
    });

    expect(lastCreateClusterOptions().defaults?.password).toBe("secret");
  });
});

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

describe("createRedisClusterClient — lifecycle", () => {
  it("connects to the cluster and returns the client", async () => {
    const fake = buildFakeClient();
    createCluster.mockReturnValueOnce(fake);

    const client = await createRedisClusterClient({ url: "cache" });

    expect(fake.connect).toHaveBeenCalledExactlyOnceWith();
    expect(client).toBe(fake);
  });

  it("re-throws any error from connect()", async () => {
    const fake = buildFakeClient();
    fake.connect = vi
      .fn()
      .mockRejectedValueOnce(new Error("dns lookup failed"));
    createCluster.mockReturnValueOnce(fake);

    await expect(createRedisClusterClient({ url: "cache" })).rejects.toThrow(
      "dns lookup failed",
    );
  });
});

// ---------------------------------------------------------------------------
// Reconnect strategy
// ---------------------------------------------------------------------------

describe("createRedisClusterClient — reconnect strategy", () => {
  it("uses a bounded linear backoff: attempt * 50ms", async () => {
    await createRedisClusterClient({ url: "cache" });

    const strategy =
      lastCreateClusterOptions().defaults?.socket?.reconnectStrategy;

    expect(typeof strategy).toBe("function");
    expect(strategy(3)).toBe(150);
  });

  it("caps the reconnect delay at 1000ms", async () => {
    await createRedisClusterClient({ url: "cache" });

    const strategy =
      lastCreateClusterOptions().defaults?.socket?.reconnectStrategy;

    expect(strategy(100)).toBe(1000);
  });
});

// ---------------------------------------------------------------------------
// Schema validation
// ---------------------------------------------------------------------------

describe("createRedisClusterClient — config validation", () => {
  it("rejects an empty url", async () => {
    await expect(createRedisClusterClient({ url: "" })).rejects.toThrow(
      "hostname must be non-empty",
    );
    expect(createCluster).not.toHaveBeenCalled();
  });

  it("rejects a url that includes a scheme", async () => {
    await expect(
      createRedisClusterClient({ url: "rediss://cache.example.com" }),
    ).rejects.toThrow("bare hostname without a scheme");
    expect(createCluster).not.toHaveBeenCalled();
  });

  it.each([
    ["negative", -1],
    ["zero", 0],
    ["over the 16-bit range", 70000],
    ["non-integer", 6380.5],
  ])("rejects a %s port (%d)", async (_label, port) => {
    await expect(
      createRedisClusterClient({ url: "cache", port }),
    ).rejects.toThrow();
    expect(createCluster).not.toHaveBeenCalled();
  });

  it("rejects an empty password", async () => {
    await expect(
      createRedisClusterClient({ url: "cache", password: "" }),
    ).rejects.toThrow();
    expect(createCluster).not.toHaveBeenCalled();
  });

  it("does not attempt to connect when validation fails", async () => {
    // Track the client the default mock would return; the factory must
    // reject at the schema step and never call `.connect()` on it.
    const fake = buildFakeClient();
    createCluster.mockReturnValueOnce(fake);

    await expect(
      createRedisClusterClient({ url: "://invalid" }),
    ).rejects.toThrow();

    expect(fake.connect).not.toHaveBeenCalled();
  });
});
