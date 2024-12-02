import { Context } from "@azure/functions";
import { TelemetryClient } from "applicationinsights";

export const contextMock = ({
  log: {
    error: jest.fn(),
    info: jest.fn(),
    verbose: jest.fn(),
    warn: jest.fn()
  },
  executionContext: {}
} as unknown) as Context;

export const telemetryClientMock = ({
  trackEvent: jest.fn()
} as unknown) as TelemetryClient;
