import { Mock, vi } from "vitest";
import {
  FnAppAPIClient,
  FnAppAPIRepositoryDeps,
} from "../../repositories/fn-app-api";

export const mockGetProfile: Mock<
  Parameters<ReturnType<FnAppAPIClient>["getProfile"]>,
  ReturnType<ReturnType<FnAppAPIClient>["getProfile"]>
> = vi.fn();
export const mockStartNotifyLoginProcess = vi.fn();
export const mockCreateProfile = vi.fn();

export const mockedFnAppAPIClient = {
  getProfile: mockGetProfile,
  createProfile: mockCreateProfile,
  startNotifyLoginProcess: mockStartNotifyLoginProcess,
} as unknown as FnAppAPIRepositoryDeps["fnAppAPIClient"];
