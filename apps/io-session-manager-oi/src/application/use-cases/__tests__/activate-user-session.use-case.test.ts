import type { NonEmptyString } from "@pagopa/hexagonal-core";
import { GenericError } from "@pagopa/hexagonal-core";
import type { LollipopAssertionRef } from "@pagopa/io-auth-n-identity-domain";
import { newPlainSessionTokens } from "@pagopa/io-auth-n-identity-session/entities";
import { newSessionId } from "@pagopa/io-auth-n-identity-session/value-objects";
import { err, ok } from "neverthrow";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  AuthEventPortMock,
  mockSendEvent,
  resetAuthEventPortMock,
} from "../../../__mocks__/ports/auth-event-port.mock.js";
import { lollipopActivationPortMock } from "../../../__mocks__/ports/lollipop-activation-port.mock.js";
import {
  mockDeletePlatformInternalSession,
  PlatformInternalPortMock,
  resetPlatformInternalPortMock,
} from "../../../__mocks__/ports/platform-internal-port.mock.js";
import {
  mockGetProfile,
  mockNotifyLogin,
  mockCreate as mockProfileCreate,
  ProfilePortMock,
  resetProfilePortMock,
} from "../../../__mocks__/ports/profile-port.mock.js";
import {
  mockInvalidatePreviousSession,
  mockCreate as mockSessionCreate,
  resetSessionPortMock,
  SessionPortMock,
} from "../../../__mocks__/ports/session-port.mock.js";
import {
  aClientSessionToken,
  aFamilyName,
  aFiscalCode,
  aGenericError,
  aHashedSessionTokenWithSessionId,
  aName,
  anEmailAddress,
  aNewSessionTokenInput,
  aNewSessionTokenInputWithoutSpidEmail,
  anIdentityProvider,
  anIpAddress,
  aNotFoundError,
  aSessionId,
  aSessionWithPlainSSOTokens,
  aUserProfileWithEmail,
  aUserProfileWithoutEmail,
  type NewSessionToken,
} from "../../../__mocks__/session.mocks.js";
import type { LollipopRevocationPort } from "../../../domain/ports/outbound/lollipop-revocation.port.js";
import type { LollipopPort } from "../../../domain/ports/outbound/lollipop.port.js";
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
  return {
    ...actual,
    newPlainSessionTokens: vi.fn(),
  };
});

const mockActivatePubKey = vi.fn();
const lollipopPort = {
  activatePubKey: mockActivatePubKey,
} as unknown as LollipopPort;
const mockRequestRevocation = vi.fn();
const lollipopRevocationPort = {
  requestRevocation: mockRequestRevocation,
} as unknown as LollipopRevocationPort;

const activateUserSessionUseCase = makeActivateUserSessionUseCase({
  sessionPort: SessionPortMock,
  profilePort: ProfilePortMock,
  platformInternalPort: PlatformInternalPortMock,
  authEventPort: AuthEventPortMock,
  lollipopActivationPort: lollipopActivationPortMock,
  lollipopPort,
  lollipopRevocationPort,
});

const assertionRef = "a-lollipop-assertion-ref" as LollipopAssertionRef;
const previousAssertionRef =
  "a-previous-lollipop-assertion-ref" as LollipopAssertionRef;
const assertionInput = {
  assertionRef,
  rawAssertion: "a-raw-saml-assertion" as NonEmptyString,
  type: "SAML" as const,
};
const activateUserSession = (sessionToken: NewSessionToken) =>
  activateUserSessionUseCase({ sessionToken, assertion: assertionInput });

beforeEach(() => {
  vi.clearAllMocks();
  resetSessionPortMock();
  resetProfilePortMock();
  resetPlatformInternalPortMock();
  resetAuthEventPortMock();
  vi.mocked(newSessionId).mockResolvedValue(aSessionId);
  vi.mocked(newPlainSessionTokens).mockResolvedValue(
    aSessionWithPlainSSOTokens,
  );
  lollipopActivationPortMock.getByFiscalCode.mockReset().mockResolvedValue(
    ok({
      fiscalCode: aFiscalCode,
      assertionRef: previousAssertionRef,
      expirationDate: new Date("2100-01-01"),
    }),
  );
  lollipopActivationPortMock.upsert
    .mockReset()
    .mockResolvedValue(ok(undefined));
  mockActivatePubKey.mockReset().mockResolvedValue(ok(assertionRef));
  mockRequestRevocation.mockReset().mockResolvedValue(ok(undefined));
  lollipopActivationPortMock.revokeByFiscalCode.mockResolvedValue(
    ok(undefined),
  );
});

const expectLoginEvent = (scenario = "standard") => {
  const [{ createdAt, expirationDate }] = mockSessionCreate.mock.calls[0];

  expect(mockSendEvent).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({
      eventType: "login",
      fiscalCode: aFiscalCode,
      ts: createdAt,
      expiredAt: expirationDate,
      loginType: "legacy",
      scenario,
      idp: anIdentityProvider,
    }),
  );
};

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
      expect(mockRequestRevocation).toHaveBeenCalledExactlyOnceWith(
        previousAssertionRef,
      );
      expect(mockRequestRevocation.mock.invocationCallOrder[0]).toBeLessThan(
        mockInvalidatePreviousSession.mock.invocationCallOrder[0],
      );
      expect(mockGetProfile).toHaveBeenCalledExactlyOnceWith(aFiscalCode);
      expect(mockProfileCreate).not.toHaveBeenCalled();
      expect(mockSessionCreate).toHaveBeenCalledOnce();
      expect(lollipopActivationPortMock.upsert).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({
          fiscalCode: aFiscalCode,
          assertionRef,
          expirationDate: expect.any(Date),
        }),
      );
      expect(mockActivatePubKey).toHaveBeenCalledExactlyOnceWith(assertionRef, {
        fiscal_code: aFiscalCode,
        assertion: assertionInput.rawAssertion,
        assertion_type: "SAML",
        expired_at: expect.any(Date),
      });
      expect(mockNotifyLogin).toHaveBeenCalledExactlyOnceWith({
        fiscalCode: aFiscalCode,
        name: aName,
        familyName: aFamilyName,
        email: anEmailAddress,
        identityProvider: anIdentityProvider,
        ipAddress: anIpAddress,
        isEmailValidated: aUserProfileWithEmail.isEmailValidated,
      });
      expectLoginEvent();

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
      expectLoginEvent();
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
      expectLoginEvent();
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
      expectLoginEvent();
    });
  });

  describe("error paths", () => {
    it("continues login when requesting Lollipop revocation fails", async () => {
      mockRequestRevocation.mockResolvedValueOnce(err(aGenericError));
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const result = await activateUserSession(aNewSessionTokenInput);

      expect(result).toMatchObject(ok(aClientSessionToken));
      expect(mockRequestRevocation).toHaveBeenCalledExactlyOnceWith(
        previousAssertionRef,
      );
      expect(errorSpy).toHaveBeenCalledExactlyOnceWith(
        `Failed to revoke lollipop: ${aGenericError.message}`,
      );
      expect(mockInvalidatePreviousSession).toHaveBeenCalledExactlyOnceWith(
        aFiscalCode,
      );
      expect(mockSessionCreate).toHaveBeenCalledOnce();
      errorSpy.mockRestore();
    });

    it("continues without requesting revocation when no previous activation exists", async () => {
      lollipopActivationPortMock.getByFiscalCode.mockResolvedValueOnce(
        err(aNotFoundError),
      );

      const result = await activateUserSession(aNewSessionTokenInput);

      expect(result).toMatchObject(ok(aClientSessionToken));
      expect(mockRequestRevocation).not.toHaveBeenCalled();
      expect(mockInvalidatePreviousSession).toHaveBeenCalledExactlyOnceWith(
        aFiscalCode,
      );
    });

    it("returns err when retrieving the previous Lollipop activation fails", async () => {
      lollipopActivationPortMock.getByFiscalCode.mockResolvedValueOnce(
        err(aGenericError),
      );

      const result = await activateUserSession(aNewSessionTokenInput);

      expect(result).toMatchObject(
        err(
          new GenericError(
            `Failed to retrieve previous lollipop activation data: ${aGenericError.message}`,
          ),
        ),
      );
      expect(mockRequestRevocation).not.toHaveBeenCalled();
      expect(mockInvalidatePreviousSession).not.toHaveBeenCalled();
      expect(mockSessionCreate).not.toHaveBeenCalled();
    });

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
      expect(mockSendEvent).not.toHaveBeenCalled();
    });

    it("returns err and stops when the Lollipop activation upsert fails", async () => {
      lollipopActivationPortMock.upsert.mockResolvedValueOnce(
        err(aGenericError),
      );

      const result = await activateUserSession(aNewSessionTokenInput);

      expect(result).toMatchObject(
        err(
          new GenericError(
            `Failed to invalidate previous lollipop activation: ${aGenericError.message}`,
          ),
        ),
      );
      expect(mockActivatePubKey).not.toHaveBeenCalled();
      expect(mockGetProfile).not.toHaveBeenCalled();
      expect(mockSessionCreate).not.toHaveBeenCalled();
    });

    it("revokes the Lollipop activation when public-key activation fails", async () => {
      mockActivatePubKey.mockResolvedValueOnce(err(aGenericError));

      const result = await activateUserSession(aNewSessionTokenInput);

      expect(result).toMatchObject(
        err(
          new GenericError(
            `Failed to activate lollipop public key: ${aGenericError.message}`,
          ),
        ),
      );
      expect(
        lollipopActivationPortMock.revokeByFiscalCode,
      ).toHaveBeenCalledExactlyOnceWith(aFiscalCode);
      expect(mockGetProfile).not.toHaveBeenCalled();
      expect(mockSessionCreate).not.toHaveBeenCalled();
    });

    it("continues returning the activation error when revocation also fails", async () => {
      mockActivatePubKey.mockResolvedValueOnce(err(aGenericError));
      lollipopActivationPortMock.revokeByFiscalCode.mockResolvedValueOnce(
        err(new GenericError("revoke failed")),
      );
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const result = await activateUserSession(aNewSessionTokenInput);

      expect(result).toMatchObject(
        err(
          new GenericError(
            `Failed to activate lollipop public key: ${aGenericError.message}`,
          ),
        ),
      );
      expect(warnSpy).toHaveBeenCalledExactlyOnceWith(
        "Failed to revoke lollipop activation: Generic error: revoke failed",
      );
      warnSpy.mockRestore();
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
      expect(mockSendEvent).not.toHaveBeenCalled();
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
      expect(mockSendEvent).not.toHaveBeenCalled();
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
      expect(mockSendEvent).not.toHaveBeenCalled();
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
      expectLoginEvent();
    });

    it("returns err when emitting the login event fails", async () => {
      mockSendEvent.mockResolvedValueOnce(err(aGenericError));

      const result = await activateUserSession(aNewSessionTokenInput);

      expect(result).toMatchObject(
        err(
          new GenericError(
            `Failed to emit login event: ${aGenericError.message}`,
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
      expect(mockSendEvent).not.toHaveBeenCalled();
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
      expectLoginEvent();
    });

    it("skips deleteSession when there is no previous session", async () => {
      // mockInvalidatePreviousSession default returns ok(undefined)
      const result = await activateUserSession(aNewSessionTokenInput);

      expect(result).toMatchObject(ok(aClientSessionToken));
      expect(mockDeletePlatformInternalSession).not.toHaveBeenCalled();
      expectLoginEvent();
    });
  });
});
