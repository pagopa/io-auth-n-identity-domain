import { vi } from "vitest";
import { FnAppAPIRepositoryDeps } from "../../repositories/fn-app-api";

export const mockGetProfile = vi.fn();
export const mockStartNotifyLoginProcess = vi.fn();

export const mockedFnAppAPIClient = {
  getProfile: mockGetProfile,
  startNotifyLoginProcess: mockStartNotifyLoginProcess,
} as unknown as FnAppAPIRepositoryDeps["fnAppAPIClient"];
