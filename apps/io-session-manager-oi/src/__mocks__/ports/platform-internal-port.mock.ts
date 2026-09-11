import { ok } from "neverthrow";
import { vi } from "vitest";

import { PlatformInternalPort } from "../../domain/ports/outbound/platform-internal.port.js";

export const mockDeletePlatformInternalSession = vi.fn();

export const PlatformInternalPortMock: PlatformInternalPort = {
  deleteSession: mockDeletePlatformInternalSession,
};

export const resetPlatformInternalPortMock = () => {
  mockDeletePlatformInternalSession.mockReset().mockResolvedValue(ok(void 0));
};
