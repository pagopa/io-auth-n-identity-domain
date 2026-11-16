import { err, ok } from "neverthrow";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  loadConfig: vi.fn(),
  loadPackageInfo: vi.fn(),
  createConfigLoader: vi.fn(),
  createApp: vi.fn(),
  listen: vi.fn(),
  close: vi.fn(),
  info: vi.fn(),
  error: vi.fn(),
  trackException: vi.fn(),
  flush: vi.fn(),
  exit: vi.fn<typeof process.exit>(() => undefined as never),
  logError: vi.fn<typeof console.error>(),
}));

vi.mock("dotenv/config", () => ({}));
vi.mock("../adapters/outbound/config-loader.js", () => ({
  createConfigLoader: mocks.createConfigLoader,
}));
vi.mock("@pagopa/io-package-info", () => ({
  createPackageInfoAdapter: () => ({ load: mocks.loadPackageInfo }),
}));
vi.mock("../domain/value-objects/configs/index.js", () => ({
  ConfigSchema: {},
}));
vi.mock("../app.js", () => ({ createApp: mocks.createApp }));
vi.mock("../telemetry-client.js", () => ({
  getLogger: () => ({
    info: mocks.info,
    error: mocks.error,
    trackException: mocks.trackException,
    flush: mocks.flush,
  }),
}));

const handlers = new Map<string, (...args: unknown[]) => void>();
const originalExitCode = process.exitCode;

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  handlers.clear();
  process.exitCode = undefined;
  vi.spyOn(process, "on").mockImplementation((event, listener) => {
    handlers.set(String(event), listener);
    return process;
  });
  mocks.exit.mockClear();
  mocks.logError.mockReset();
  mocks.info.mockReset();
  mocks.error.mockReset();
  mocks.trackException.mockReset();
  mocks.flush.mockReset().mockResolvedValue(undefined);
  // Never terminate the test runner; real exits are tested in child processes.
  vi.spyOn(process, "exit").mockImplementation(mocks.exit);
  vi.spyOn(console, "error").mockImplementation(mocks.logError);
  mocks.loadConfig
    .mockReset()
    .mockReturnValue(
      ok({ HOST: "127.0.0.1", PORT: 3000, NODE_ENV: "development" }),
    );
  mocks.createConfigLoader
    .mockReset()
    .mockReturnValue({ load: mocks.loadConfig });
  mocks.loadPackageInfo
    .mockReset()
    .mockReturnValue(ok({ name: "io-web-auth-service", version: "0.1.0" }));
  mocks.listen.mockReset().mockResolvedValue(undefined);
  mocks.close.mockReset().mockResolvedValue(undefined);
  mocks.createApp.mockReset().mockResolvedValue({
    server: {
      listen: mocks.listen,
      close: mocks.close,
      log: { info: mocks.info },
    },
  });
});

afterEach(() => {
  process.exitCode = originalExitCode;
  vi.restoreAllMocks();
  vi.useRealTimers();
});

const emit = (event: string, ...args: unknown[]) => {
  const handler = handlers.get(event);
  expect(handler).toBeDefined();
  handler?.(...args);
};

describe("bootstrap and lifecycle", () => {
  it("loads metadata and starts the server without exiting", async () => {
    await import("../main.js");

    expect(mocks.createConfigLoader).toHaveBeenCalledExactlyOnceWith(
      expect.anything(),
    );
    expect(mocks.createApp).toHaveBeenCalledExactlyOnceWith(
      { HOST: "127.0.0.1", PORT: 3000, NODE_ENV: "development" },
      { name: "io-web-auth-service", version: "0.1.0" },
    );
    expect(mocks.info).toHaveBeenCalledWith("Starting application", {
      name: "io-web-auth-service",
      version: "0.1.0",
    });
    expect(mocks.listen).toHaveBeenCalledExactlyOnceWith({
      host: "127.0.0.1",
      port: 3000,
    });
    expect(mocks.exit).not.toHaveBeenCalled();
  });

  it.each(["SIGTERM", "SIGINT"])(
    "closes before exiting on %s",
    async (signal) => {
      let finishClose!: () => void;
      mocks.close.mockReturnValueOnce(
        new Promise<void>((resolve) => {
          finishClose = resolve;
        }),
      );
      await import("../main.js");

      emit(signal);

      expect(mocks.close).toHaveBeenCalledOnce();
      expect(mocks.exit).not.toHaveBeenCalled();
      finishClose();
      await vi.advanceTimersByTimeAsync(0);
      expect(mocks.flush).toHaveBeenCalledOnce();
      expect(mocks.exit).toHaveBeenCalledExactlyOnceWith(0);
      expect(vi.getTimerCount()).toBe(0);
    },
  );

  it("closes only once when signals are repeated", async () => {
    await import("../main.js");

    emit("SIGTERM");
    emit("SIGINT");
    emit("SIGTERM");
    await vi.advanceTimersByTimeAsync(0);

    expect(mocks.close).toHaveBeenCalledOnce();
    expect(mocks.exit).toHaveBeenCalledExactlyOnceWith(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(["uncaughtException", "unhandledRejection"])(
    "exits with failure on %s",
    async (event) => {
      await import("../main.js");
      const error = new Error("fatal failure");

      emit(event, error);
      await vi.advanceTimersByTimeAsync(0);

      expect(mocks.trackException).toHaveBeenCalledWith({
        error,
        properties: { contextMessage: "Fatal application error" },
      });
      expect(mocks.close).toHaveBeenCalledOnce();
      expect(mocks.exit).toHaveBeenCalledExactlyOnceWith(1);
      expect(vi.getTimerCount()).toBe(0);
    },
  );

  it.each(["uncaughtException", "unhandledRejection"])(
    "keeps a fatal %s failure even between repeated signals",
    async (event) => {
      await import("../main.js");
      const error = new Error("fatal failure");

      emit("SIGTERM");
      emit(event, error);
      emit("SIGINT");
      await vi.advanceTimersByTimeAsync(0);

      expect(mocks.trackException).toHaveBeenCalledWith({
        error,
        properties: { contextMessage: "Fatal application error" },
      });
      expect(mocks.close).toHaveBeenCalledOnce();
      expect(mocks.exit).toHaveBeenCalledExactlyOnceWith(1);
    },
  );

  it("forces failure exit at the shutdown deadline", async () => {
    mocks.close.mockReturnValueOnce(new Promise<void>(() => {}));
    await import("../main.js");

    emit("SIGTERM");
    await vi.advanceTimersByTimeAsync(9_999);
    expect(mocks.exit).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);

    expect(mocks.exit).toHaveBeenCalledExactlyOnceWith(1);
    expect(mocks.error).toHaveBeenCalledWith("Application shutdown timed out");
    expect(mocks.logError).toHaveBeenCalledWith(
      "Application shutdown timed out",
    );
  });

  it("reports close failures and exits with failure", async () => {
    const error = new Error("close failed");
    mocks.close.mockRejectedValueOnce(error);
    await import("../main.js");

    emit("SIGINT");
    await vi.advanceTimersByTimeAsync(0);

    expect(mocks.trackException).toHaveBeenCalledWith({
      error,
      properties: { contextMessage: "Failed to close application" },
    });
    expect(mocks.exit).toHaveBeenCalledExactlyOnceWith(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(["configuration", "package info", "createApp", "listen"])(
    "reports %s startup failure",
    async (stage) => {
      const error = new Error("startup failed");
      if (stage === "configuration") {
        mocks.loadConfig.mockReturnValueOnce(err(error));
      }
      if (stage === "package info") {
        mocks.loadPackageInfo.mockReturnValueOnce(err(error));
      }
      if (stage === "createApp") {
        mocks.createApp.mockRejectedValueOnce(error);
      }
      if (stage === "listen") mocks.listen.mockRejectedValueOnce(error);

      await import("../main.js");
      await vi.advanceTimersByTimeAsync(0);

      if (stage === "listen") {
        expect(mocks.close).toHaveBeenCalledOnce();
        expect(mocks.trackException).toHaveBeenCalledWith({
          error,
          properties: { contextMessage: "Fatal application error" },
        });
      } else {
        expect(mocks.close).not.toHaveBeenCalled();
        expect(mocks.listen).not.toHaveBeenCalled();
        expect(handlers.size).toBe(0);
        expect(mocks.trackException).toHaveBeenCalledWith({
          error:
            stage === "createApp"
              ? error
              : expect.objectContaining({
                  message:
                    stage === "configuration"
                      ? "Failed to load configuration"
                      : "Failed to load package info",
                  cause: error,
                }),
          properties: { contextMessage: "Failed to start application" },
        });
        if (stage !== "createApp") {
          expect(mocks.createApp).not.toHaveBeenCalled();
        }
      }
      expect(mocks.flush).toHaveBeenCalledOnce();
      expect(mocks.exit).toHaveBeenCalledExactlyOnceWith(1);
      expect(vi.getTimerCount()).toBe(0);
    },
  );

  it("does not install lifecycle handlers while the app is being created", async () => {
    mocks.createApp.mockImplementationOnce(async () => {
      expect(handlers.size).toBe(0);
      expect(vi.getTimerCount()).toBe(0);
      return {
        server: {
          listen: mocks.listen,
          close: mocks.close,
          log: { info: mocks.info },
        },
      };
    });
    mocks.listen.mockImplementationOnce(async () => {
      expect([...handlers.keys()]).toEqual([
        "SIGTERM",
        "SIGINT",
        "uncaughtException",
        "unhandledRejection",
      ]);
    });

    await import("../main.js");

    expect(mocks.createApp).toHaveBeenCalledExactlyOnceWith(
      { HOST: "127.0.0.1", PORT: 3000, NODE_ENV: "development" },
      { name: "io-web-auth-service", version: "0.1.0" },
    );
    expect(mocks.listen).toHaveBeenCalledOnce();
    expect(mocks.exit).not.toHaveBeenCalled();
  });

  it("cleans up when listen throws synchronously", async () => {
    const error = new Error("invalid listen options");
    mocks.listen.mockImplementationOnce(() => {
      throw error;
    });

    await import("../main.js");
    await vi.advanceTimersByTimeAsync(0);

    expect(mocks.close).toHaveBeenCalledOnce();
    expect(mocks.trackException).toHaveBeenCalledWith({
      error,
      properties: { contextMessage: "Fatal application error" },
    });
    expect(mocks.exit).toHaveBeenCalledExactlyOnceWith(1);
    expect(vi.getTimerCount()).toBe(0);
  });
});
