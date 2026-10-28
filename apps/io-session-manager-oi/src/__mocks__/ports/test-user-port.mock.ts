import { vi } from "vitest";

import type { TestUserPort } from "../../domain/ports/outbound/test-user.port.js";

export const mockIsTestUser = vi.fn();
export const mockIsTestCredentials = vi.fn();

export const TestUserPortMock: TestUserPort = {
  isTestUser: mockIsTestUser,
  isTestCredentials: mockIsTestCredentials,
};

export const resetTestUserPortMock = () => {
  mockIsTestUser.mockReset().mockReturnValue(false);
  mockIsTestCredentials.mockReset().mockReturnValue(false);
};
