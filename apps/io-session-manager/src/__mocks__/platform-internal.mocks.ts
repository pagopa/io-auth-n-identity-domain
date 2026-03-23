import { vi } from "vitest";
import * as TE from "fp-ts/lib/TaskEither";
import { PlatformInternalService } from "../services";

export const mockCacheDelSessionToken = vi.fn().mockReturnValue(TE.right(true));

export const mockPlatformInternalAPIService = {
  cacheDelSessionToken: mockCacheDelSessionToken,
} as unknown as typeof PlatformInternalService;
