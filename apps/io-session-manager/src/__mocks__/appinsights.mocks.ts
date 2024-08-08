import * as appInsights from "applicationinsights";

import { vi } from "vitest";

// TODO: Add types when appinsights lib will be added
export const mockTrackEvent = vi.fn();
export const mockTrackDependency = vi.fn();

export const mockedAppinsightsTelemetryClient = {
  trackEvent: mockTrackEvent,
  trackDependency: mockTrackDependency,
} as any as appInsights.TelemetryClient;
