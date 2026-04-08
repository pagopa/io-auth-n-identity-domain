import { vi } from "vitest";
import { InvocationContext } from "@azure/functions";
import { TelemetryClient } from "applicationinsights";

export const contextMock = {
  log: vi.fn(),
  debug: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
} as unknown as InvocationContext;

export const telemetryClientMock = {
  trackEvent: vi.fn(),
} as unknown as TelemetryClient;
