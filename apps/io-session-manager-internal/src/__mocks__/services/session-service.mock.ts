import { vi } from "vitest";
import * as RTE from "fp-ts/lib/ReaderTaskEither";
import { SessionService } from "../../services/session-service";

export const mockGetUserSession = vi
  .fn()
  .mockReturnValue(RTE.right({ active: true }));

export const SessionServiceMock: SessionService = {
  getUserSession: mockGetUserSession,
};
