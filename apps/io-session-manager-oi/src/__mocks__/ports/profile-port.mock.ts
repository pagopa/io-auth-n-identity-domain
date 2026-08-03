import { ok } from "neverthrow";
import { vi } from "vitest";

import { ProfilePort } from "../../domain/ports/outbound/profile.port.js";
import { aUserProfileWithEmail } from "../session.mocks.js";

export const mockGetProfile = vi.fn();
export const mockCreate = vi.fn();
export const mockNotifyLogin = vi.fn();

export const ProfilePortMock: ProfilePort = {
  getProfile: mockGetProfile,
  create: mockCreate,
  notifyLogin: mockNotifyLogin,
};

export const resetProfilePortMock = () => {
  mockGetProfile.mockReset().mockResolvedValue(ok(aUserProfileWithEmail));
  mockCreate.mockReset().mockResolvedValue(ok(aUserProfileWithEmail));
  mockNotifyLogin.mockReset().mockResolvedValue(ok(undefined));
};
