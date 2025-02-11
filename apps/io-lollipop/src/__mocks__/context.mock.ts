import { vi } from "vitest";
import { Context } from "@azure/functions";
import { TelemetryClient } from "applicationinsights";

export const contextMock = ({
  log: {
    error: vi.fn(),
    info: vi.fn(),
    verbose: vi.fn(),
    warn: vi.fn()
  },
  executionContext: {}
} as unknown) as Context;

export const telemetryClientMock = ({
  trackEvent: vi.fn()
} as unknown) as TelemetryClient;
