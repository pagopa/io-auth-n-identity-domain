import { vi } from "vitest";

// TODO: Add types when appinsights lib will be added
export const mockTrackEvent = vi.fn();

export const mockedAppinsightsTelemetryClient = {
  trackEvent: mockTrackEvent,
};
