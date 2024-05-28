import { Mock, vi } from "vitest";
import { FnAppAPIClient } from "../../repositories/fn-app-api";

export const mockGetProfile: Mock<
  Parameters<ReturnType<FnAppAPIClient>["getProfile"]>,
  ReturnType<ReturnType<FnAppAPIClient>["getProfile"]>
> = vi.fn();
export const mockStartNotifyLoginProcess: Mock<
  Parameters<ReturnType<FnAppAPIClient>["startNotifyLoginProcess"]>,
  ReturnType<ReturnType<FnAppAPIClient>["startNotifyLoginProcess"]>
> = vi.fn();
export const mockCreateProfile: Mock<
  Parameters<ReturnType<FnAppAPIClient>["createProfile"]>,
  ReturnType<ReturnType<FnAppAPIClient>["createProfile"]>
> = vi.fn();

export const mockedFnAppAPIClient: ReturnType<FnAppAPIClient> = {
  getProfile: mockGetProfile,
  createProfile: mockCreateProfile,
  startNotifyLoginProcess: mockStartNotifyLoginProcess,
  abortUserDataProcessing: vi.fn(),
  getService: vi.fn(),
  getServicePreferences: vi.fn(),
  getUserDataProcessing: vi.fn(),
  getVisibleServices: vi.fn(),
  startEmailValidationProcess: vi.fn(),
  updateProfile: vi.fn(),
  upsertServicePreferences: vi.fn(),
  upsertUserDataProcessing: vi.fn(),
};
