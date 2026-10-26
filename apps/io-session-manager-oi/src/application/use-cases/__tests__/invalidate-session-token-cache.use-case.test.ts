import { GenericError } from "@pagopa/hexagonal-core";
import { err, ok } from "neverthrow";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockDeletePlatformInternalSession,
  PlatformInternalPortMock,
  resetPlatformInternalPortMock,
} from "../../../__mocks__/ports/platform-internal-port.mock.js";
import {
  aGenericError,
  aHashedSessionTokenWithSessionId,
} from "../../../__mocks__/session.mocks.js";
import { makeInvalidateSessionTokenCacheUseCase } from "../invalidate-session-token-cache.use-case.js";

const invalidateSessionTokenCacheUseCase =
  makeInvalidateSessionTokenCacheUseCase({
    platformInternalPort: PlatformInternalPortMock,
  });

beforeEach(() => {
  vi.clearAllMocks();
  resetPlatformInternalPortMock();
});

describe("makeInvalidateSessionTokenCacheUseCase", () => {
  it("deletes the hashed client session token from the proxy", async () => {
    const result = await invalidateSessionTokenCacheUseCase(
      aHashedSessionTokenWithSessionId,
    );

    expect(result).toEqual(ok(undefined));
    expect(mockDeletePlatformInternalSession).toHaveBeenCalledExactlyOnceWith(
      `${aHashedSessionTokenWithSessionId.sessionId}.${aHashedSessionTokenWithSessionId.hashedSessionToken}`,
    );
  });

  it("returns an error when the proxy deletion fails", async () => {
    mockDeletePlatformInternalSession.mockResolvedValueOnce(err(aGenericError));

    const result = await invalidateSessionTokenCacheUseCase(
      aHashedSessionTokenWithSessionId,
    );

    expect(result).toEqual(
      err(
        new GenericError(
          `Failed to invalidate previous session on proxy: ${aGenericError.message}`,
        ),
      ),
    );
  });
});
