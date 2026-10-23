import { AuthenticationError, GenericError } from "@pagopa/hexagonal-core";
import {
  newPlainSessionTokens,
  toHashedSessionTokens,
} from "@pagopa/io-auth-n-identity-session/entities";
import { err, ok } from "neverthrow";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockFindActiveSession,
  mockFindSessionTokenBySessionId,
  mockRefresh,
  resetSessionPortMock,
  SessionPortMock,
} from "../../../__mocks__/ports/session-port.mock.js";
import {
  aClientSessionToken,
  aFiscalCode,
  aGenericError,
  aHashedSessionTokenWithSessionId,
  aNewSessionTokenInput,
  aNotFoundError,
  aSessionId,
  aSessionWithHashedTokens,
  aSessionWithPlainSSOTokens,
} from "../../../__mocks__/session.mocks.js";
import { makeRefreshUserSessionUseCase } from "../refresh-user-session.use-case.js";

vi.mock("@pagopa/io-auth-n-identity-session/entities", async (importActual) => {
  const actual =
    await importActual<
      typeof import("@pagopa/io-auth-n-identity-session/entities")
    >();
  return { ...actual, newPlainSessionTokens: vi.fn() };
});

const mockNewPlainSessionTokens = vi.mocked(newPlainSessionTokens);
const mockInvalidateSessionTokenCache = vi.fn();
const refreshUserSessionUseCase = makeRefreshUserSessionUseCase({
  sessionPort: SessionPortMock,
  invalidateSessionTokenCacheUseCase: mockInvalidateSessionTokenCache,
});

beforeEach(() => {
  vi.clearAllMocks();
  resetSessionPortMock();
  mockInvalidateSessionTokenCache.mockResolvedValue(ok(undefined));
  mockFindActiveSession.mockResolvedValue(
    ok({
      fiscalCode: aFiscalCode,
      loginType: "LV",
      sessionId: aSessionId,
      createdAt: new Date("2025-01-01T00:00:00.000Z"),
      expirationDate: new Date("2026-01-01T00:00:00.000Z"),
    }),
  );
  mockNewPlainSessionTokens.mockResolvedValue(aSessionWithPlainSSOTokens);
  mockRefresh.mockResolvedValue(ok(aSessionWithHashedTokens));
});

describe("makeRefreshUserSessionUseCase", () => {
  it("refreshes token documents under the existing active session ID", async () => {
    const result = await refreshUserSessionUseCase({
      sessionToken: aNewSessionTokenInput,
    });

    expect(result).toEqual(ok(aClientSessionToken));
    expect(mockFindActiveSession).toHaveBeenCalledExactlyOnceWith(aFiscalCode);
    expect(mockNewPlainSessionTokens).toHaveBeenCalledExactlyOnceWith({
      fiscalCode: aFiscalCode,
      name: aNewSessionTokenInput.name,
      familyName: aNewSessionTokenInput.familyName,
      dateOfBirth: aNewSessionTokenInput.dateOfBirth,
      spidLevel: aNewSessionTokenInput.spidLevel,
      spidEmail: aNewSessionTokenInput.spidEmail,
      sessionId: aSessionId,
      loginType: "LV",
    });
    expect(mockRefresh).toHaveBeenCalledExactlyOnceWith(
      toHashedSessionTokens({
        ...aSessionWithPlainSSOTokens,
        expirationDate: new Date("2026-01-01T00:00:00.000Z"),
      }),
    );
    expect(mockFindSessionTokenBySessionId).toHaveBeenCalledExactlyOnceWith(
      aSessionId,
    );
  });

  it("skips cache invalidation when there is no previous session token", async () => {
    const result = await refreshUserSessionUseCase({
      sessionToken: aNewSessionTokenInput,
    });

    expect(result).toEqual(ok(aClientSessionToken));
    expect(mockInvalidateSessionTokenCache).not.toHaveBeenCalled();
    expect(mockRefresh).toHaveBeenCalledOnce();
  });

  it("invalidates the previous session token cache after refreshing", async () => {
    mockFindSessionTokenBySessionId.mockResolvedValueOnce(
      ok(aHashedSessionTokenWithSessionId),
    );

    const result = await refreshUserSessionUseCase({
      sessionToken: aNewSessionTokenInput,
    });

    expect(result).toEqual(ok(aClientSessionToken));
    expect(mockInvalidateSessionTokenCache).toHaveBeenCalledExactlyOnceWith(
      aHashedSessionTokenWithSessionId,
    );
    expect(
      mockFindSessionTokenBySessionId.mock.invocationCallOrder[0],
    ).toBeLessThan(mockRefresh.mock.invocationCallOrder[0]);
    expect(mockRefresh.mock.invocationCallOrder[0]).toBeLessThan(
      mockInvalidateSessionTokenCache.mock.invocationCallOrder[0],
    );
  });

  it("returns an error and does not refresh when the previous session token lookup fails", async () => {
    mockFindSessionTokenBySessionId.mockResolvedValueOnce(err(aGenericError));

    const result = await refreshUserSessionUseCase({
      sessionToken: aNewSessionTokenInput,
    });

    expect(result).toEqual(
      err(
        new GenericError(
          `Failed to retrieve previous session token: ${aGenericError.message}`,
        ),
      ),
    );
    expect(mockInvalidateSessionTokenCache).not.toHaveBeenCalled();
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it("returns an error when cache invalidation fails after refreshing", async () => {
    mockFindSessionTokenBySessionId.mockResolvedValueOnce(
      ok(aHashedSessionTokenWithSessionId),
    );
    mockInvalidateSessionTokenCache.mockResolvedValueOnce(err(aGenericError));

    const result = await refreshUserSessionUseCase({
      sessionToken: aNewSessionTokenInput,
    });

    expect(result).toEqual(err(aGenericError));
    expect(mockRefresh).toHaveBeenCalledOnce();
  });

  it("does not invalidate the cache when refresh fails", async () => {
    mockFindSessionTokenBySessionId.mockResolvedValueOnce(
      ok(aHashedSessionTokenWithSessionId),
    );
    mockRefresh.mockResolvedValueOnce(err(aGenericError));

    const result = await refreshUserSessionUseCase({
      sessionToken: aNewSessionTokenInput,
    });

    expect(result).toEqual(err(expect.any(GenericError)));
    expect(mockInvalidateSessionTokenCache).not.toHaveBeenCalled();
  });

  it("preserves the generated token expiry when it precedes the active session expiry", async () => {
    const generatedTokenExpirationDate = new Date("2025-06-01T00:00:00.000Z");
    mockNewPlainSessionTokens.mockResolvedValueOnce({
      ...aSessionWithPlainSSOTokens,
      expirationDate: generatedTokenExpirationDate,
    });

    await refreshUserSessionUseCase({
      sessionToken: aNewSessionTokenInput,
    });

    expect(mockRefresh).toHaveBeenCalledExactlyOnceWith(
      toHashedSessionTokens({
        ...aSessionWithPlainSSOTokens,
        expirationDate: generatedTokenExpirationDate,
      }),
    );
  });

  it("returns AuthenticationError when there is no active session to refresh", async () => {
    mockFindActiveSession.mockResolvedValueOnce(err(aNotFoundError));

    const result = await refreshUserSessionUseCase({
      sessionToken: aNewSessionTokenInput,
    });

    expect(result).toEqual(err(expect.any(AuthenticationError)));
    expect(mockFindSessionTokenBySessionId).not.toHaveBeenCalled();
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it("returns GenericError when the active session lookup fails", async () => {
    mockFindActiveSession.mockResolvedValueOnce(err(aGenericError));

    const result = await refreshUserSessionUseCase({
      sessionToken: aNewSessionTokenInput,
    });

    expect(result).toEqual(
      err(
        new GenericError(
          `Failed to retrieve active session: ${aGenericError.message}`,
        ),
      ),
    );
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it("returns an error when token refresh fails", async () => {
    mockRefresh.mockResolvedValueOnce(err(aGenericError));

    const result = await refreshUserSessionUseCase({
      sessionToken: aNewSessionTokenInput,
    });

    expect(result).toEqual(err(expect.any(GenericError)));
  });
});
