import { vi } from "vitest";
import * as E from "fp-ts/lib/Either";

export const mockDeleteSession = vi.fn().mockResolvedValue(
  E.right({
    status: 204,
  }),
);
export const mockPlatformInternalClient = {
  deleteSession: mockDeleteSession,
};
