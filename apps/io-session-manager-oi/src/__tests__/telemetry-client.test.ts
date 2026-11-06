import { SeverityNumber } from "@opentelemetry/api-logs";
import type { NonEmptyString } from "@pagopa/hexagonal-core";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  aiEmit: vi.fn(),
  emitCustomEvent: vi.fn(),
  getLogger: vi.fn(),
  makeApplicationInsightsLogger: vi.fn(),
  sendCustomEvent: vi.fn(),
  applicationLogger: {},
}));

vi.mock("@opentelemetry/api-logs", () => ({
  SeverityNumber: { ERROR: 17, WARN: 13 },
  logs: { getLogger: mocks.getLogger },
}));
vi.mock("@pagopa/azure-tracing/logger", () => ({
  emitCustomEvent: mocks.emitCustomEvent,
}));
vi.mock("@pagopa/hexagonal-core/adapters/logger", () => ({
  makeApplicationInsightsLogger: mocks.makeApplicationInsightsLogger,
}));

import { getLogger } from "../telemetry-client.js";

const getTelemetryClient = () => {
  getLogger("io-session-manager-oi" as NonEmptyString);
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

  it("creates a service-scoped application insights logger", () => {
    const service = "io-session-manager-oi" as NonEmptyString;

    expect(getLogger(service)).toBe(mocks.applicationLogger);
    expect(mocks.getLogger).toHaveBeenCalledExactlyOnceWith(service);
    expect(mocks.makeApplicationInsightsLogger).toHaveBeenCalledWith({
      client: expect.any(Object),
      baseProperties: { service },
    });
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
        "exception.stack": exception.stack,
      },
      body: "request failed",
      severityNumber: SeverityNumber.ERROR,
    });
  });

  it("emits traces with stringified properties and the given severity", () => {
    getTelemetryClient().trackTrace({
      message: "cache miss",
      properties: { key: "session", count: 0 },
      severity: SeverityNumber.WARN,
    });

    expect(mocks.aiEmit).toHaveBeenCalledExactlyOnceWith({
      attributes: { key: "session", count: "0" },
      body: "cache miss",
      severityNumber: SeverityNumber.WARN,
    });
  });
});
