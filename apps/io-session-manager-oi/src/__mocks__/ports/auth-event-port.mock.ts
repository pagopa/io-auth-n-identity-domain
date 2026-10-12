import { ok } from "neverthrow";
import { vi } from "vitest";

import { AuthEventPort } from "../../domain/ports/outbound/auth-event.port.js";

export const mockSendEvent = vi.fn();
export const mockHealthcheck = vi.fn();

export const AuthEventPortMock: AuthEventPort = {
  sendEvent: mockSendEvent,
  healthcheck: mockHealthcheck,
};

export const resetAuthEventPortMock = () => {
  mockSendEvent.mockReset().mockResolvedValue(ok(undefined));
  mockHealthcheck.mockReset().mockResolvedValue(ok(undefined));
};
