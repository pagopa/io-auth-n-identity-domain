import { vi } from "vitest";
import * as TE from "fp-ts/lib/TaskEither";
import { PlatformInternalService } from "../services";

export const mockCacheDelSessionToken = vi.fn().mockReturnValue(TE.right(true));
export const mockCacheDelSessionTokens = vi.fn()
.mockImplementation((tokens: ReadonlyArray<string>) => () => 
  TE.right(
    Array(tokens.length).fill(true as const) as ReadonlyArray<true>
  )
);

export const mockPlatformInternalAPIService = {
  cacheDelSessionToken: mockCacheDelSessionToken,
  cacheDelSessionTokens: mockCacheDelSessionTokens,
} as unknown as typeof PlatformInternalService;
