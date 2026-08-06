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
  mockInvalidatePreviousSession,
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
  aHashedSessionTokenWithSessionId,
  aName,
  aNewSessionTokenInput,
  aNewSessionTokenInputWithoutSpidEmail,
  aNotFoundError,
  anIdentityProvider,
  anIpAddress,
  aSessionId,
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
      expect(mockInvalidatePreviousSession).toHaveBeenCalledExactlyOnceWith(
        aFiscalCode,
      );
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
    it("returns err when invalidatePreviousSession fails", async () => {
      mockInvalidatePreviousSession.mockResolvedValueOnce(err(aGenericError));

      const result = await activateUserSession(aNewSessionTokenInput);

      expect(result).toMatchObject(
        err(
          new GenericError(
            `Failed to invalidate previous sessions: ${aGenericError.message}`,
          ),
        ),
      );
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
      mockInvalidatePreviousSession.mockResolvedValueOnce(
        ok(aHashedSessionTokenWithSessionId),
      );
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
      expect(mockSessionCreate).not.toHaveBeenCalled();
    });
  });

  describe("proxy deleteSession", () => {
    it("calls deleteSession with the hashed session token when a previous session exists", async () => {
      mockInvalidatePreviousSession.mockResolvedValueOnce(
        ok(aHashedSessionTokenWithSessionId),
      );

      const result = await activateUserSession(aNewSessionTokenInput);

      expect(result).toMatchObject(ok(aClientSessionToken));
      expect(mockDeletePlatformInternalSession).toHaveBeenCalledExactlyOnceWith(
        `${aHashedSessionTokenWithSessionId.sessionId}.${aHashedSessionTokenWithSessionId.hashedSessionToken}`,
      );
    });

    it("skips deleteSession when there is no previous session", async () => {
      // mockInvalidatePreviousSession default returns ok(undefined)
      const result = await activateUserSession(aNewSessionTokenInput);

      expect(result).toMatchObject(ok(aClientSessionToken));
      expect(mockDeletePlatformInternalSession).not.toHaveBeenCalled();
    });
  });
});
