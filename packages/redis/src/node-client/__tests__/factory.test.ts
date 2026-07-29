import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClient } = vi.hoisted(() => ({
  createClient: vi.fn(),
}));

vi.mock("redis", () => ({ createClient }));

import { createRedisNodeClient } from "../factory.js";

const buildFakeClient = () => ({
  connect: vi.fn().mockResolvedValue(undefined),
});

const lastCreateClientOptions = () => {
  const call = createClient.mock.calls.at(-1);
  if (!call) throw new Error("createClient was not called");
  return call[0];
};

beforeEach(() => {
  vi.clearAllMocks();
  createClient.mockImplementation(buildFakeClient);
});

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

describe("createRedisNodeClient — defaults", () => {
  it("uses rediss:// and port 6380 by default", async () => {
    await createRedisNodeClient({ url: "cache.example.com" });

    const opts = lastCreateClientOptions();
    expect(opts.url).toBe("rediss://cache.example.com:6380");
    expect(opts.socket).toMatchObject({ tls: true, keepAlive: 2000 });
  });

  it("switches to redis:// port 6379 when enableTls is false", async () => {
    await createRedisNodeClient({ url: "localhost", enableTls: false });

    const opts = lastCreateClientOptions();
    expect(opts.url).toBe("redis://localhost:6379");
    expect(opts.socket).toMatchObject({ tls: false });
  });

  it("honours an explicit port", async () => {
    await createRedisNodeClient({ url: "cache.example.com", port: 7001 });

    expect(lastCreateClientOptions().url).toBe(
      "rediss://cache.example.com:7001",
    );
  });

  it("forwards the password", async () => {
    await createRedisNodeClient({
      url: "cache.example.com",
      password: "secret",
    });

    expect(lastCreateClientOptions().password).toBe("secret");
  });
});

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

describe("createRedisNodeClient — lifecycle", () => {
  it("connects and returns the client", async () => {
    const fake = buildFakeClient();
    createClient.mockReturnValueOnce(fake);

    const client = await createRedisNodeClient({ url: "cache" });

    expect(fake.connect).toHaveBeenCalledExactlyOnceWith();
    expect(client).toBe(fake);
  });

  it("re-throws any error from connect()", async () => {
    const fake = buildFakeClient();
    fake.connect = vi
      .fn()
      .mockRejectedValueOnce(new Error("dns lookup failed"));
    createClient.mockReturnValueOnce(fake);

    await expect(createRedisNodeClient({ url: "cache" })).rejects.toThrow(
      "dns lookup failed",
    );
  });
});

// ---------------------------------------------------------------------------
// Reconnect strategy
// ---------------------------------------------------------------------------

describe("createRedisNodeClient — reconnect strategy", () => {
  it("uses a bounded linear backoff: attempt * 50ms", async () => {
    await createRedisNodeClient({ url: "cache" });

    const strategy = lastCreateClientOptions().socket?.reconnectStrategy;

    expect(typeof strategy).toBe("function");
    expect(strategy(3)).toBe(150);
  });

  it("caps the reconnect delay at 1000ms", async () => {
    await createRedisNodeClient({ url: "cache" });

    const strategy = lastCreateClientOptions().socket?.reconnectStrategy;

    expect(strategy(100)).toBe(1000);
  });
});

// ---------------------------------------------------------------------------
// Schema validation
// ---------------------------------------------------------------------------

describe("createRedisNodeClient — config validation", () => {
  it("rejects an empty url", async () => {
    await expect(createRedisNodeClient({ url: "" })).rejects.toThrow(
      "hostname must be non-empty",
    );
    expect(createClient).not.toHaveBeenCalled();
  });

  it("rejects a url that includes a scheme", async () => {
    await expect(
      createRedisNodeClient({ url: "rediss://cache.example.com" }),
    ).rejects.toThrow("bare hostname without a scheme");
    expect(createClient).not.toHaveBeenCalled();
  });

  it.each([
    ["negative", -1],
    ["zero", 0],
    ["over the 16-bit range", 70000],
    ["non-integer", 6380.5],
  ])("rejects a %s port (%d)", async (_label, port) => {
    await expect(
      createRedisNodeClient({ url: "cache", port }),
    ).rejects.toThrow();
    expect(createClient).not.toHaveBeenCalled();
  });

  it("rejects an empty password", async () => {
    await expect(
      createRedisNodeClient({ url: "cache", password: "" }),
    ).rejects.toThrow();
    expect(createClient).not.toHaveBeenCalled();
  });

  it("does not attempt to connect when validation fails", async () => {
    const fake = buildFakeClient();
    createClient.mockReturnValueOnce(fake);

    await expect(
      createRedisNodeClient({ url: "://invalid" }),
    ).rejects.toThrow();

    expect(fake.connect).not.toHaveBeenCalled();
  });
});
