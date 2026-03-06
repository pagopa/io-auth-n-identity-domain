import * as TE from "fp-ts/lib/TaskEither";
import { vi } from "vitest";
import { PlatformInternalRepository } from "../../repositories/platform-internal";

export const mockCacheDelSessionToken = vi.fn().mockReturnValue(TE.right(true));

export const PlatformInternalRepositoryMock: PlatformInternalRepository = {
  cacheDelSessionToken: mockCacheDelSessionToken,
};
