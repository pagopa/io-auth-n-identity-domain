import { vi } from "vitest";
import * as TE from "fp-ts/lib/TaskEither";
import { PlatformInternalService } from "../services";

export const mockCacheDelSessionToken = vi.fn().mockReturnValue(TE.right(true));
// The following mocks a method with the signature: RTE.ReaderTaskEither<PlatformInternalClientDeps & AppInsightsDeps, Error, ReadonlyArray<true>>
// It should return an array of true values, one for each session token to delete, based on the length of the input tokens array.
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
