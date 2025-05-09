import { vi } from "vitest";
import * as RTE from "fp-ts/lib/ReaderTaskEither";
import { SessionLockRepository } from "../../repositories/session-lock";
import { aNotReleasedData } from "../table-client.mock";

export const mockGetUserAuthenticationLocks = vi
  .fn()
  .mockReturnValue(RTE.right([aNotReleasedData]));
export const mockLockUserAuthentication = vi
  .fn()
  .mockReturnValue(RTE.right(true));
export const mockIsUserAuthenticationLocked = vi
  .fn()
  .mockReturnValue(RTE.right(false));

export const SessionLockRepositoryMock: SessionLockRepository = {
  getUserAuthenticationLocks: mockGetUserAuthenticationLocks,
  lockUserAuthentication: mockLockUserAuthentication,
  isUserAuthenticationLocked: mockIsUserAuthenticationLocked,
};
