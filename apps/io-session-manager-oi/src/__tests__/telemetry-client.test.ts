import { SeverityNumber } from "@opentelemetry/api-logs";
import type { NonEmptyString } from "@pagopa/hexagonal-core";
import type { AppInsightsTelemetryClient } from "@pagopa/hexagonal-core/adapters/logger";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  aiEmit: vi.fn(),
  emitCustomEvent: vi.fn(),
  getLogger: vi.fn(),
  makeApplicationInsightsLogger: vi.fn(),
  sendCustomEvent: vi.fn(),
  applicationLogger: {},
}));

vi.mock("@opentelemetry/api-logs", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@opentelemetry/api-logs")>()),
  logs: { getLogger: mocks.getLogger },
}));
vi.mock("@pagopa/azure-tracing/logger", () => ({
  emitCustomEvent: mocks.emitCustomEvent,
}));
vi.mock("@pagopa/hexagonal-core/adapters/logger", () => ({
  makeApplicationInsightsLogger: mocks.makeApplicationInsightsLogger,
}));

import { getLoggerBuilder } from "../telemetry-client.js";

const getTelemetryClient = (): AppInsightsTelemetryClient => {
  getLoggerBuilder(
    "io-session-manager-oi" as NonEmptyString,
    "1.0.0" as NonEmptyString,
  )("test");
  return mocks.makeApplicationInsightsLogger.mock.calls[0][0].client;
};

describe("telemetry client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getLogger.mockReturnValue({ emit: mocks.aiEmit });
    mocks.makeApplicationInsightsLogger.mockReturnValue(
      mocks.applicationLogger,
    );
    mocks.emitCustomEvent.mockReturnValue(mocks.sendCustomEvent);
  });

  it("creates component-scoped loggers over a shared telemetry client", () => {
    const service = "io-session-manager-oi" as NonEmptyString;
    const version = "1.0.0" as NonEmptyString;
    const loggerBuilder = getLoggerBuilder(service, version);

    expect(mocks.getLogger).toHaveBeenCalledExactlyOnceWith(service);
    expect(loggerBuilder("main")).toBe(mocks.applicationLogger);
    expect(loggerBuilder("Readiness")).toBe(mocks.applicationLogger);
    expect(mocks.getLogger).toHaveBeenCalledExactlyOnceWith(service);
    expect(mocks.makeApplicationInsightsLogger).toHaveBeenCalledTimes(2);
    const [mainLogger, readinessLogger] =
      mocks.makeApplicationInsightsLogger.mock.calls.map(([deps]) => deps);
    expect(mainLogger).toEqual({
      client: readinessLogger?.client,
      baseProperties: { service, version, component: "main" },
    });
    expect(readinessLogger).toEqual({
      client: mainLogger?.client,
      baseProperties: { service, version, component: "Readiness" },
    });
    expect(mainLogger?.client).toBe(readinessLogger?.client);
    expect(mainLogger?.client).toBeDefined();
    expect(readinessLogger?.client).toBeDefined();
  });

  it("emits custom events with stringified properties", () => {
    getTelemetryClient().trackEvent({
      name: "user-login",
      properties: { attempt: 2, active: true },
    });

    expect(mocks.emitCustomEvent).toHaveBeenCalledExactlyOnceWith(
      "user-login",
      { attempt: "2", active: "true" },
    );
    expect(mocks.sendCustomEvent).toHaveBeenCalledOnce();
  });

  it("emits exceptions with error severity and stack metadata", () => {
    const exception = new Error("request failed");

    getTelemetryClient().trackException({
      exception,
      properties: { requestId: 42 },
    });

    expect(mocks.aiEmit).toHaveBeenCalledExactlyOnceWith({
      attributes: {
        requestId: "42",
        "exception.type": exception.name,
        "exception.stacktrace": exception.stack,
        "exception.message": exception.message,
      },
      body: "request failed",
      severityNumber: SeverityNumber.ERROR,
    });
  });

  it("emits exceptions without a stack or properties", () => {
    const exception = new TypeError("invalid input");
    delete exception.stack;

    getTelemetryClient().trackException({ exception });

    expect(mocks.aiEmit).toHaveBeenCalledExactlyOnceWith({
      attributes: {
        "exception.type": "TypeError",
        "exception.stacktrace": "",
        "exception.message": "invalid input",
      },
      body: "invalid input",
      severityNumber: SeverityNumber.ERROR,
    });
  });

  it.each([
    { severity: 0, severityNumber: SeverityNumber.DEBUG },
    { severity: 1, severityNumber: SeverityNumber.INFO },
    { severity: 2, severityNumber: SeverityNumber.WARN },
    { severity: 3, severityNumber: SeverityNumber.ERROR },
    { severity: 4, severityNumber: SeverityNumber.FATAL },
  ] as const)(
    "maps trace severity $severity to OpenTelemetry severity $severityNumber",
    ({ severity, severityNumber }) => {
      getTelemetryClient().trackTrace({
        message: "cache miss",
        properties: { key: "session", count: 0 },
        severity,
      });

      expect(mocks.aiEmit).toHaveBeenCalledExactlyOnceWith({
        attributes: { key: "session", count: "0" },
        body: "cache miss",
        severityNumber,
      });
    },
  );

  it("emits custom events without properties", () => {
    getTelemetryClient().trackEvent({ name: "user-login" });

    expect(mocks.emitCustomEvent).toHaveBeenCalledExactlyOnceWith(
      "user-login",
      {},
    );
    expect(mocks.sendCustomEvent).toHaveBeenCalledOnce();
  });

  it("emits traces without properties", () => {
    getTelemetryClient().trackTrace({ message: "cache miss", severity: 1 });

    expect(mocks.aiEmit).toHaveBeenCalledExactlyOnceWith({
      attributes: {},
      body: "cache miss",
      severityNumber: SeverityNumber.INFO,
    });
  });
});
