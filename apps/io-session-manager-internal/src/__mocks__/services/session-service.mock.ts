import { vi } from "vitest";
import * as RTE from "fp-ts/lib/ReaderTaskEither";
import * as R from "fp-ts/lib/Reader";
import * as TE from "fp-ts/lib/TaskEither";
import { SessionService } from "../../services/session-service";

export const mockInvalidateUserSession = vi
  .fn()
  .mockReturnValue(R.of([TE.of(true), TE.of(true), TE.of(true)]));

export const mockGetUserSession = vi
  .fn()
  .mockReturnValue(RTE.right({ active: true }));

export const mockLockUserAuthentication = vi
  .fn()
  .mockReturnValue(RTE.right(null));

export const SessionServiceMock: SessionService = {
  invalidateUserSession: mockInvalidateUserSession,
  getUserSession: mockGetUserSession,
  lockUserAuthentication: mockLockUserAuthentication,
};
