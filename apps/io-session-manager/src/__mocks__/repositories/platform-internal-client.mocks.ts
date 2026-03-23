import { vi } from "vitest";
import * as E from "fp-ts/lib/Either";

export const mockDeleteSession = vi
  .fn()
  .mockResolvedValue(E.right({ status: 204, value: undefined }));

export const mockedPlatformInternalAPIClient = {
  deleteSession: mockDeleteSession,
};
