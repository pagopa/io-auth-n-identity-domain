import { GenericError } from "@pagopa/hexagonal-core";
import {
  newPlainSessionTokens,
  toHashedSessionTokens,
} from "@pagopa/io-auth-n-identity-session/entities";
import { err, ok } from "neverthrow";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockFindActiveSession,
  mockRefresh,
  resetSessionPortMock,
  SessionPortMock,
} from "../../../__mocks__/ports/session-port.mock.js";
import {
  aClientSessionToken,
  aFiscalCode,
  aGenericError,
  aNewSessionTokenInput,
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
});

beforeEach(() => {
  vi.clearAllMocks();
  resetSessionPortMock();
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

  it("returns an error when there is no active session to refresh", async () => {
    mockFindActiveSession.mockResolvedValueOnce(err(aGenericError));

    const result = await refreshUserSessionUseCase({
      sessionToken: aNewSessionTokenInput,
    });

    expect(result).toEqual(err(expect.any(GenericError)));
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
