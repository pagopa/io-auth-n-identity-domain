import { ok } from "neverthrow";
import { vi } from "vitest";

import { PlatformInternalPort } from "@pagopa/io-session-manager-core";

export const mockDeletePlatformInternalSession = vi.fn();

export const PlatformInternalPortMock: PlatformInternalPort = {
  deleteSession: mockDeletePlatformInternalSession,
};

export const resetPlatformInternalPortMock = () => {
  mockDeletePlatformInternalSession.mockReset().mockResolvedValue(ok(void 0));
};
