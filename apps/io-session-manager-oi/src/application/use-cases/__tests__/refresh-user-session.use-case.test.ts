import { AuthenticationError, GenericError } from "@pagopa/hexagonal-core";
import {
  newPlainSessionTokens,
  toHashedSessionTokens,
} from "@pagopa/io-auth-n-identity-session/entities";
import { HashedSessionTokenSchema } from "@pagopa/io-auth-n-identity-session/value-objects";
import { err, ok } from "neverthrow";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockDeletePlatformInternalSession,
  PlatformInternalPortMock,
  resetPlatformInternalPortMock,
} from "../../../__mocks__/ports/platform-internal-port.mock.js";
import {
  mockFindActiveSession,
  mockFindSessionTokenBySessionId,
  mockRefresh,
  resetSessionPortMock,
  SessionPortMock,
} from "../../../../../../packages/io-session-manager-core/src/__mocks__/domain/ports/session.port.mock.js";
import {
  aClientSessionToken,
  aFiscalCode,
  aGenericError,
  aHashedClientSessionToken,
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
const refreshUserSessionUseCase = makeRefreshUserSessionUseCase({
  sessionPort: SessionPortMock,
  platformInternalPort: PlatformInternalPortMock,
});

beforeEach(() => {
  vi.clearAllMocks();
  resetSessionPortMock();
  resetPlatformInternalPortMock();
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
      idp: aNewSessionTokenInput.idp,
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
    expect(mockDeletePlatformInternalSession).not.toHaveBeenCalled();
    expect(mockRefresh).toHaveBeenCalledOnce();
  });

  it("waits for the proxy to delete the previous hashed token before issuing the new client token", async () => {
    const previousHash = HashedSessionTokenSchema.parse("a".repeat(64));
    mockFindSessionTokenBySessionId.mockResolvedValueOnce(
      ok({ sessionId: aSessionId, hashedSessionToken: previousHash }),
    );
    const completeDeletion = vi.fn<() => void>();
    mockDeletePlatformInternalSession.mockReturnValueOnce(
      new Promise((resolve) => {
        completeDeletion.mockImplementation(() => resolve(ok(undefined)));
      }),
    );

    const execution = refreshUserSessionUseCase({
      sessionToken: aNewSessionTokenInput,
    });

    await vi.waitFor(() =>
      expect(mockDeletePlatformInternalSession).toHaveBeenCalledExactlyOnceWith(
        `${aSessionId}.${previousHash}`,
      ),
    );
    expect(
      mockFindSessionTokenBySessionId.mock.invocationCallOrder[0],
    ).toBeLessThan(
      mockDeletePlatformInternalSession.mock.invocationCallOrder[0],
    );
    expect(mockNewPlainSessionTokens).not.toHaveBeenCalled();
    expect(mockRefresh).not.toHaveBeenCalled();

    completeDeletion();
    expect(await execution).toEqual(ok(aClientSessionToken));
    expect(mockRefresh).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        sessionId: aSessionId,
        hashedSessionToken: aSessionWithHashedTokens.hashedSessionToken,
      }),
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
    expect(mockDeletePlatformInternalSession).not.toHaveBeenCalled();
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it("returns an error and does not refresh when cache invalidation fails", async () => {
    mockFindSessionTokenBySessionId.mockResolvedValueOnce(
      ok(aHashedSessionTokenWithSessionId),
    );
    mockDeletePlatformInternalSession.mockResolvedValueOnce(err(aGenericError));

    const result = await refreshUserSessionUseCase({
      sessionToken: aNewSessionTokenInput,
    });

    const error = result._unsafeUnwrapErr();
    expect(error).toBeInstanceOf(GenericError);
    expect(error.message).toBe(
      new GenericError("Failed to invalidate previous session on proxy")
        .message,
    );
    expect(error.cause).toBe(aGenericError);
    expect(mockNewPlainSessionTokens).not.toHaveBeenCalled();
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it("invalidates the cache before returning a refresh failure", async () => {
    mockFindSessionTokenBySessionId.mockResolvedValueOnce(
      ok(aHashedSessionTokenWithSessionId),
    );
    mockRefresh.mockResolvedValueOnce(err(aGenericError));

    const result = await refreshUserSessionUseCase({
      sessionToken: aNewSessionTokenInput,
    });

    expect(result).toEqual(
      err(
        new GenericError(
          `Failed to refresh user session: ${aGenericError.message}`,
        ),
      ),
    );
    expect(mockDeletePlatformInternalSession).toHaveBeenCalledExactlyOnceWith(
      aHashedClientSessionToken,
    );
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
