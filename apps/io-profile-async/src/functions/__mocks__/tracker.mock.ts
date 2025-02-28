import { vi } from "vitest";

import * as T from "fp-ts/lib/Task";
import { Tracker } from "../../repositories";

export const trackEventMock = vi.fn((..._args) => () => T.of(void 0));
export const traceMigratingServicePreferencesMock = vi.fn((..._args) => () =>
  T.of(void 0)
);

export const trackerMock: Tracker = {
  trackEvent: trackEventMock,
  traceMigratingServicePreferences: traceMigratingServicePreferencesMock
};
