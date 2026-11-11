import { err, ok } from "neverthrow";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  loadConfig: vi.fn(),
  loadPackageInfo: vi.fn(),
  createConfigLoader: vi.fn(),
  createApp: vi.fn(),
  getLoggerBuilder: vi.fn(),
  loggerBuilder: vi.fn(),
  listen: vi.fn(),
  close: vi.fn(),
  exit: vi.fn<typeof process.exit>(() => undefined as never),
  logError: vi.fn<typeof console.error>(),
  loggerInfo: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock("dotenv/config", () => ({}));
vi.mock("@pagopa/io-package-info", () => ({
  createPackageInfoAdapter: () => ({ load: mocks.loadPackageInfo }),
}));
vi.mock("../adapters/outbound/config-loader.js", () => ({
  createConfigLoader: mocks.createConfigLoader,
}));
vi.mock("../domain/value-objects/configs/index.js", () => ({
  ConfigSchema: {},
}));
vi.mock("../app.js", () => ({ createApp: mocks.createApp }));
vi.mock("../telemetry-client.js", () => ({
  getLoggerBuilder: mocks.getLoggerBuilder,
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
  mocks.loggerInfo.mockReset();
  mocks.loggerError.mockReset();
  mocks.loggerBuilder.mockReset().mockImplementation(() => ({
    info: mocks.loggerInfo,
    error: mocks.loggerError,
  }));
  mocks.getLoggerBuilder.mockReset().mockReturnValue(mocks.loggerBuilder);
  vi.spyOn(process, "exit").mockImplementation(mocks.exit);
  vi.spyOn(console, "error").mockImplementation(mocks.logError);
  mocks.loadConfig
    .mockReset()
    .mockReturnValue(ok({ HOST: "127.0.0.1", PORT: 8080 }));
  mocks.createConfigLoader
    .mockReset()
    .mockReturnValue({ load: mocks.loadConfig });
  mocks.loadPackageInfo
    .mockReset()
    .mockReturnValue(ok({ name: "test-app", version: "1.0.0" }));
  mocks.listen.mockReset().mockResolvedValue(undefined);
  mocks.close.mockReset().mockResolvedValue(undefined);
  mocks.createApp.mockReset().mockResolvedValue({
    server: { listen: mocks.listen, close: mocks.close },
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

describe("application lifecycle", () => {
  it("starts the server without exiting", async () => {
    await import("../main.js");

    expect(mocks.createConfigLoader).toHaveBeenCalledExactlyOnceWith(
      expect.anything(),
      {
        mappings: {
          TEST_LOGIN_FISCAL_CODES: "TEST_LOGIN_FISCAL_CODES_COMPRESSED",
        },
      },
    );
    expect(mocks.listen).toHaveBeenCalledExactlyOnceWith({
      host: "127.0.0.1",
      port: 8080,
    });
    expect(mocks.loggerInfo).toHaveBeenCalledExactlyOnceWith(
      "Server listening",
      { host: "127.0.0.1", port: 8080 },
    );
    expect(mocks.loggerBuilder).toHaveBeenCalledWith("main");
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
  });

  it.each(["uncaughtException", "unhandledRejection"])(
    "exits with failure on %s",
    async (event) => {
      await import("../main.js");
      const error = new Error("fatal failure");

      emit(event, error);
      await vi.advanceTimersByTimeAsync(0);

      expect(mocks.loggerError).toHaveBeenCalledWith(
        `Fatal application error: ${String(error)}`,
      );
      expect(mocks.close).toHaveBeenCalledOnce();
      expect(mocks.exit).toHaveBeenCalledExactlyOnceWith(1);
    },
  );

  it("preserves failure exit status when a signal follows a fatal error", async () => {
    await import("../main.js");

    emit("SIGTERM");
    emit("unhandledRejection", new Error("fatal failure"));
    emit("SIGINT");
    await vi.advanceTimersByTimeAsync(0);

    expect(mocks.close).toHaveBeenCalledOnce();
    expect(mocks.exit).toHaveBeenCalledExactlyOnceWith(1);
  });

  it("forces failure exit when shutdown exceeds its timeout", async () => {
    mocks.close.mockReturnValueOnce(new Promise<void>(() => {}));
    await import("../main.js");

    emit("SIGTERM");
    await vi.advanceTimersByTimeAsync(9_999);
    expect(mocks.exit).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);

    expect(mocks.exit).toHaveBeenCalledExactlyOnceWith(1);
    expect(mocks.loggerError).toHaveBeenCalledWith(
      "Application shutdown timed out",
    );
  });

  it.each([
    {
      scenario: "an error with a stack",
      error: Object.assign(new Error("close failed"), {
        stack: "Error: close failed\n    at server.close",
      }),
      message: "Error: close failed\n    at server.close",
    },
    {
      scenario: "an error without a stack",
      error: Object.assign(new Error("close failed"), { stack: undefined }),
      message: "close failed",
    },
    {
      scenario: "a non-Error rejection",
      error: "close failed",
      message: "close failed",
    },
  ])(
    "exits with failure when closing fails with $scenario",
    async ({ error, message }) => {
      mocks.close.mockRejectedValueOnce(error);
      await import("../main.js");

      emit("SIGINT");
      await vi.advanceTimersByTimeAsync(0);

      expect(mocks.loggerError).toHaveBeenCalledWith(
        `Failed to close application: ${message}`,
      );
      expect(mocks.exit).toHaveBeenCalledExactlyOnceWith(1);
      expect(vi.getTimerCount()).toBe(0);
    },
  );

  it.each(["configuration", "package info", "createApp", "listen"])(
    "handles %s startup failure",
    async (stage) => {
      const error = new Error("startup failed");
      if (stage === "configuration")
        mocks.loadConfig.mockReturnValueOnce(err(error));
      if (stage === "package info")
        mocks.loadPackageInfo.mockReturnValueOnce(err(error));
      if (stage === "createApp") mocks.createApp.mockRejectedValueOnce(error);
      if (stage === "listen") mocks.listen.mockRejectedValueOnce(error);

      await import("../main.js");

      if (stage === "listen") {
        await vi.advanceTimersByTimeAsync(0);
        expect(mocks.close).toHaveBeenCalledOnce();
        expect(mocks.loggerError).toHaveBeenCalledWith(
          `Fatal application error: ${String(error)}`,
        );
      } else {
        expect(mocks.close).not.toHaveBeenCalled();
        expect(mocks.listen).not.toHaveBeenCalled();
        expect(handlers.size).toBe(0);
        expect(vi.getTimerCount()).toBe(0);
        expect(mocks.logError).toHaveBeenCalledWith(
          "Failed to start application:",
          expect.any(Error),
        );
        if (stage !== "createApp") {
          expect(mocks.createApp).not.toHaveBeenCalled();
        }
      }
      expect(mocks.exit).toHaveBeenCalledExactlyOnceWith(1);
    },
  );

  it("does not install lifecycle handlers while the app is being created", async () => {
    mocks.createApp.mockImplementationOnce(async () => {
      expect(handlers.size).toBe(0);
      expect(vi.getTimerCount()).toBe(0);
      return { server: { listen: mocks.listen, close: mocks.close } };
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
      { HOST: "127.0.0.1", PORT: 8080 },
      { name: "test-app", version: "1.0.0" },
      mocks.loggerBuilder,
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
    expect(mocks.loggerError).toHaveBeenCalledWith(
      `Fatal application error: ${String(error)}`,
    );
    expect(mocks.exit).toHaveBeenCalledExactlyOnceWith(1);
    expect(vi.getTimerCount()).toBe(0);
  });
});
