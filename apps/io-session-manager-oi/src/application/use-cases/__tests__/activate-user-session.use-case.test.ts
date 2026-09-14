import { GenericError } from "@pagopa/hexagonal-core";
import { newPlainSession } from "@pagopa/io-auth-n-identity-session/entities";
import { newSessionId } from "@pagopa/io-auth-n-identity-session/value-objects";
import { err, ok } from "neverthrow";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockCreate as mockProfileCreate,
  mockGetProfile,
  mockNotifyLogin,
  ProfilePortMock,
  resetProfilePortMock,
} from "../../../__mocks__/ports/profile-port.mock.js";
import {
  mockCreate as mockSessionCreate,
  mockDelete as mockSessionDelete,
  mockFindByFiscalCode,
  resetSessionPortMock,
  SessionPortMock,
} from "../../../__mocks__/ports/session-port.mock.js";
import {
  mockDeletePlatformInternalSession,
  PlatformInternalPortMock,
  resetPlatformInternalPortMock,
} from "../../../__mocks__/ports/platform-internal-port.mock.js";
import {
  aClientSessionToken,
  anEmailAddress,
  aFamilyName,
  aFiscalCode,
  aGenericError,
  aName,
  aNewSessionTokenInput,
  aNewSessionTokenInputWithoutSpidEmail,
  aNotFoundError,
  anIdentityProvider,
  anIpAddress,
  aSessionId,
  aSessionWithHashedTokens,
  aSessionWithPlainTokens,
  aUserProfileWithEmail,
  aUserProfileWithoutEmail,
} from "../../../__mocks__/session.mocks.js";
import { makeActivateUserSessionUseCase } from "../activate-user-session.use-case.js";

// -----------------------------------------------------
// Setup mocks
// -----------------------------------------------------

vi.mock(
  "@pagopa/io-auth-n-identity-session/value-objects",
  async (importActual) => {
    const actual =
      await importActual<
        typeof import("@pagopa/io-auth-n-identity-session/value-objects")
      >();
    return { ...actual, newSessionId: vi.fn() };
  },
);

vi.mock("@pagopa/io-auth-n-identity-session/entities", async (importActual) => {
  const actual =
    await importActual<
      typeof import("@pagopa/io-auth-n-identity-session/entities")
    >();
  return { ...actual, newPlainSession: vi.fn() };
});

const activateUserSession = makeActivateUserSessionUseCase(
  SessionPortMock,
  ProfilePortMock,
  PlatformInternalPortMock,
);

beforeEach(() => {
  vi.clearAllMocks();
  resetSessionPortMock();
  resetProfilePortMock();
  resetPlatformInternalPortMock();
  vi.mocked(newSessionId).mockResolvedValue(aSessionId);
  vi.mocked(newPlainSession).mockResolvedValue(aSessionWithPlainTokens);
});

// -----------------------------------------------------
// Tests
// -----------------------------------------------------

describe("makeActivateUserSessionUseCase", () => {
  describe("happy paths", () => {
    it("returns the client session token and persists the hashed session", async () => {
      const result = await activateUserSession(aNewSessionTokenInput);

      expect(result).toMatchObject(ok(aClientSessionToken));
      expect(mockFindByFiscalCode).toHaveBeenCalledExactlyOnceWith(aFiscalCode);
      expect(mockSessionDelete).not.toHaveBeenCalled();
      expect(mockGetProfile).toHaveBeenCalledExactlyOnceWith(aFiscalCode);
      expect(mockProfileCreate).not.toHaveBeenCalled();
      expect(mockSessionCreate).toHaveBeenCalledOnce();
      expect(mockNotifyLogin).toHaveBeenCalledExactlyOnceWith({
        fiscalCode: aFiscalCode,
        name: aName,
        familyName: aFamilyName,
        email: anEmailAddress,
        identityProvider: anIdentityProvider,
        ipAddress: anIpAddress,
        isEmailValidated: aUserProfileWithEmail.isEmailValidated,
      });

      const [activeSessionArg, sessionTokensArg] =
        mockSessionCreate.mock.calls[0];
      expect(activeSessionArg).toMatchObject({
        sessionId: aSessionId,
        fiscalCode: aFiscalCode,
      });
      expect(sessionTokensArg).toHaveProperty("hashedSessionToken");
      expect(sessionTokensArg).not.toHaveProperty("plainSessionToken");
    });

    it("succeeds without creating a profile nor notifying when the profile exists without email", async () => {
      mockGetProfile.mockResolvedValueOnce(ok(aUserProfileWithoutEmail));

      const result = await activateUserSession(aNewSessionTokenInput);

      expect(result).toMatchObject(ok(aClientSessionToken));
      expect(mockProfileCreate).not.toHaveBeenCalled();
      expect(mockNotifyLogin).not.toHaveBeenCalled();
    });

    it("creates the profile and skips notification when no spid email is provided", async () => {
      mockGetProfile.mockResolvedValueOnce(err(aNotFoundError));
      mockProfileCreate.mockResolvedValueOnce(ok(aUserProfileWithoutEmail));

      const result = await activateUserSession(
        aNewSessionTokenInputWithoutSpidEmail,
      );

      expect(result).toMatchObject(ok(aClientSessionToken));
      expect(mockProfileCreate).toHaveBeenCalledExactlyOnceWith({
        fiscalCode: aFiscalCode,
        isEmailValidated: false,
        email: undefined,
      });
      expect(mockNotifyLogin).not.toHaveBeenCalled();
    });

    it("creates the profile and notifies login when a spid email is provided", async () => {
      mockGetProfile.mockResolvedValueOnce(err(aNotFoundError));

      const result = await activateUserSession(aNewSessionTokenInput);

      expect(result).toMatchObject(ok(aClientSessionToken));
      expect(mockProfileCreate).toHaveBeenCalledExactlyOnceWith({
        fiscalCode: aFiscalCode,
        isEmailValidated: false,
        email: anEmailAddress,
      });
      expect(mockNotifyLogin).toHaveBeenCalledExactlyOnceWith({
        fiscalCode: aFiscalCode,
        name: aName,
        familyName: aFamilyName,
        email: anEmailAddress,
        identityProvider: anIdentityProvider,
        ipAddress: anIpAddress,
        isEmailValidated: false,
      });
    });
  });

  describe("error paths", () => {
    it("returns err when findByFiscalCode fails", async () => {
      mockFindByFiscalCode.mockResolvedValueOnce(err(aGenericError));

      const result = await activateUserSession(aNewSessionTokenInput);

      expect(result).toMatchObject(
        err(
          new GenericError(
            `Failed to find previous session: ${aGenericError.message}`,
          ),
        ),
      );
      expect(mockSessionDelete).not.toHaveBeenCalled();
      expect(mockSessionCreate).not.toHaveBeenCalled();
    });

    it("returns err when deleting the previous session fails", async () => {
      mockFindByFiscalCode.mockResolvedValueOnce(ok(aSessionWithHashedTokens));
      mockSessionDelete.mockResolvedValueOnce(err(aGenericError));

      const result = await activateUserSession(aNewSessionTokenInput);

      expect(result).toMatchObject(
        err(
          new GenericError(
            `Failed to invalidate previous sessions: ${aGenericError.message}`,
          ),
        ),
      );
      expect(mockDeletePlatformInternalSession).toHaveBeenCalledOnce();
      expect(mockSessionCreate).not.toHaveBeenCalled();
    });

    it("returns err when retrieving the profile fails with a generic error", async () => {
      mockGetProfile.mockResolvedValueOnce(err(aGenericError));

      const result = await activateUserSession(aNewSessionTokenInput);

      expect(result).toMatchObject(
        err(
          new GenericError(
            `Failed to retrieve user profile: ${aGenericError.message}`,
          ),
        ),
      );
      expect(mockSessionCreate).not.toHaveBeenCalled();
    });

    it("returns err when creating the profile fails", async () => {
      mockGetProfile.mockResolvedValueOnce(err(aNotFoundError));
      mockProfileCreate.mockResolvedValueOnce(err(aGenericError));

      const result = await activateUserSession(aNewSessionTokenInput);

      expect(result).toMatchObject(
        err(
          new GenericError(
            `Failed to create user profile: ${aGenericError.message}`,
          ),
        ),
      );
      expect(mockSessionCreate).not.toHaveBeenCalled();
    });

    it("returns err when persisting the session fails", async () => {
      mockSessionCreate.mockResolvedValueOnce(err(aGenericError));

      const result = await activateUserSession(aNewSessionTokenInput);

      expect(result).toMatchObject(
        err(
          new GenericError(
            `Failed to persist user session: ${aGenericError.message}`,
          ),
        ),
      );
      expect(mockNotifyLogin).not.toHaveBeenCalled();
    });

    it("returns err when notifying the login event fails", async () => {
      mockNotifyLogin.mockResolvedValueOnce(err(aGenericError));

      const result = await activateUserSession(aNewSessionTokenInput);

      expect(result).toMatchObject(
        err(
          new GenericError(
            `Failed to notify login event: ${aGenericError.message}`,
          ),
        ),
      );
    });

    it("returns err when proxy deleteSession fails", async () => {
      mockFindByFiscalCode.mockResolvedValueOnce(ok(aSessionWithHashedTokens));
      mockDeletePlatformInternalSession.mockResolvedValueOnce(
        err(aGenericError),
      );

      const result = await activateUserSession(aNewSessionTokenInput);

      expect(result).toMatchObject(
        err(
          new GenericError(
            `Failed to invalidate previous session on proxy: ${aGenericError.message}`,
          ),
        ),
      );
      expect(mockSessionDelete).not.toHaveBeenCalled();
      expect(mockSessionCreate).not.toHaveBeenCalled();
    });
  });

  describe("proxy deleteSession", () => {
    it("calls deleteSession then delete when a previous session exists", async () => {
      mockFindByFiscalCode.mockResolvedValueOnce(ok(aSessionWithHashedTokens));

      const result = await activateUserSession(aNewSessionTokenInput);

      expect(result).toMatchObject(ok(aClientSessionToken));
      expect(mockDeletePlatformInternalSession).toHaveBeenCalledExactlyOnceWith(
        `${aSessionWithHashedTokens.sessionId}.${aSessionWithHashedTokens.hashedSessionToken}`,
      );
      expect(mockSessionDelete).toHaveBeenCalledExactlyOnceWith(
        aSessionWithHashedTokens,
      );
    });

    it("skips deleteSession and delete when there is no previous session", async () => {
      const result = await activateUserSession(aNewSessionTokenInput);

      expect(result).toMatchObject(ok(aClientSessionToken));
      expect(mockDeletePlatformInternalSession).not.toHaveBeenCalled();
      expect(mockSessionDelete).not.toHaveBeenCalled();
    });
  });
});
