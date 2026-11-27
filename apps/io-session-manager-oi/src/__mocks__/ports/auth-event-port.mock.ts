import { ok } from "neverthrow";
import { vi } from "vitest";
import type { AuthEventPort } from "@pagopa/io-session-manager-core";

export const mockSendEvent = vi.fn();

export const AuthEventPortMock: AuthEventPort = {
  sendEvent: mockSendEvent,
};

export const resetAuthEventPortMock = () => {
  mockSendEvent.mockReset().mockResolvedValue(ok(undefined));
};
