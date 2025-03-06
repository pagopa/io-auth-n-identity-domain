import { vi } from "vitest";
import { Tracker } from "../../repositories";

export const trackEventMock = vi.fn((..._args) => () => void 0);
export const traceMigratingServicePreferencesMock = vi.fn((..._args) => () =>
  void 0
);

export const trackerMock: Tracker = {
  trackEvent: trackEventMock,
  traceMigratingServicePreferences: traceMigratingServicePreferencesMock
};
