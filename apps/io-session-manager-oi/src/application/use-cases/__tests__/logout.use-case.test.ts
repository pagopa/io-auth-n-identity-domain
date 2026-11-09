import { GenericError } from "@pagopa/hexagonal-core";
import { LollipopAssertionRefSchema } from "@pagopa/io-auth-n-identity-domain";
import { err, ok } from "neverthrow";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  AuthEventPortMock,
  mockSendEvent,
  resetAuthEventPortMock,
} from "../../../__mocks__/ports/auth-event-port.mock.js";
import { lollipopActivationPortMock } from "../../../__mocks__/ports/lollipop-activation-port.mock.js";
import {
  mockDelete,
  mockInvalidatePreviousSession,
  resetSessionPortMock,
  SessionPortMock,
} from "../../../__mocks__/ports/session-port.mock.js";
import {
  aBaseSession,
  aFiscalCode,
  aGenericError,
  aHashedSessionTokenWithSessionId,
  aNotFoundError,
  aPlainSessionToken,
  aSessionWithHashedTokens,
} from "../../../__mocks__/session.mocks.js";
import type { LollipopRevocationPort } from "../../../domain/ports/outbound/lollipop-revocation.port.js";
import {
  type InvalidateProvidedUserStateUseCase,
  makeInvalidateProvidedUserStateUseCase,
} from "../invalidate-provided-user-state.use-case.js";
import type { InvalidateSessionTokenCacheUseCase } from "../invalidate-session-token-cache.use-case.js";
import { makeLogoutUseCase } from "../logout.use-case.js";

const assertionRef = LollipopAssertionRefSchema.parse(
  `sha256-${"a".repeat(43)}`,
);
const requestRevocation = vi.fn<LollipopRevocationPort["requestRevocation"]>();
const invalidateSessionTokenCache = vi.fn<InvalidateSessionTokenCacheUseCase>();
const logout = makeLogoutUseCase({
  authEventPort: AuthEventPortMock,
  invalidateProvidedUserStateUseCase: makeInvalidateProvidedUserStateUseCase({
    sessionPort: SessionPortMock,
    lollipopActivationPort: lollipopActivationPortMock,
    lollipopRevocationPort: { requestRevocation },
    invalidateSessionTokenCacheUseCase: invalidateSessionTokenCache,
  }),
});
const input = { session: aBaseSession, sessionToken: aPlainSessionToken };

beforeEach(() => {
  resetAuthEventPortMock();
  resetSessionPortMock();
  mockDelete.mockResolvedValue(ok(undefined));
  lollipopActivationPortMock.getByFiscalCode.mockReset().mockResolvedValue(
    ok({
      fiscalCode: aFiscalCode,
      assertionRef,
      expirationDate: new Date("2100-01-01"),
    }),
  );
  lollipopActivationPortMock.revokeByFiscalCode
    .mockReset()
    .mockResolvedValue(ok(undefined));
  requestRevocation.mockReset().mockResolvedValue(ok(undefined));
  invalidateSessionTokenCache.mockReset().mockResolvedValue(ok(undefined));
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("makeLogoutUseCase", () => {
  it("delegates user state cleanup with the authenticated session tokens", async () => {
    const invalidateProvidedUserStateUseCase = vi
      .fn<InvalidateProvidedUserStateUseCase>()
      .mockResolvedValue(ok(undefined));
    const logoutWithMockedCleanup = makeLogoutUseCase({
      authEventPort: AuthEventPortMock,
      invalidateProvidedUserStateUseCase,
    });

    expect(await logoutWithMockedCleanup(input)).toEqual(ok(undefined));
    expect(invalidateProvidedUserStateUseCase).toHaveBeenCalledExactlyOnceWith(
      aSessionWithHashedTokens,
    );
    expect(
      invalidateProvidedUserStateUseCase.mock.invocationCallOrder[0],
    ).toBeLessThan(mockSendEvent.mock.invocationCallOrder[0]);
  });

  it("propagates user state cleanup errors without emitting logout", async () => {
    const invalidateProvidedUserStateUseCase = vi
      .fn<InvalidateProvidedUserStateUseCase>()
      .mockResolvedValue(err(aGenericError));
    const logoutWithMockedCleanup = makeLogoutUseCase({
      authEventPort: AuthEventPortMock,
      invalidateProvidedUserStateUseCase,
    });

    const result = await logoutWithMockedCleanup(input);

    expect(result._unsafeUnwrapErr()).toBe(aGenericError);
    expect(mockSendEvent).not.toHaveBeenCalled();
  });

  it("revokes Lollipop, deletes the authenticated session and clears its cache before emitting logout", async () => {
    expect(await logout(input)).toEqual(ok(undefined));
    expect(
      lollipopActivationPortMock.getByFiscalCode,
    ).toHaveBeenCalledExactlyOnceWith(aFiscalCode);
    expect(requestRevocation).toHaveBeenCalledExactlyOnceWith(assertionRef);
    expect(
      lollipopActivationPortMock.revokeByFiscalCode,
    ).toHaveBeenCalledExactlyOnceWith(aFiscalCode);
    expect(mockDelete).toHaveBeenCalledExactlyOnceWith(
      aSessionWithHashedTokens,
    );
    expect(mockInvalidatePreviousSession).not.toHaveBeenCalled();
    expect(invalidateSessionTokenCache).toHaveBeenCalledExactlyOnceWith(
      aHashedSessionTokenWithSessionId,
    );
    expect(mockSendEvent).toHaveBeenCalledExactlyOnceWith({
      eventType: "logout",
      fiscalCode: aFiscalCode,
      scenario: "app",
      ts: expect.any(Date),
    });
    expect(
      lollipopActivationPortMock.revokeByFiscalCode.mock.invocationCallOrder[0],
    ).toBeLessThan(mockDelete.mock.invocationCallOrder[0]);
    expect(mockDelete.mock.invocationCallOrder[0]).toBeLessThan(
      invalidateSessionTokenCache.mock.invocationCallOrder[0],
    );
    expect(
      invalidateSessionTokenCache.mock.invocationCallOrder[0],
    ).toBeLessThan(mockSendEvent.mock.invocationCallOrder[0]);
  });

  it("continues deleting the authenticated session when no Lollipop activation exists", async () => {
    lollipopActivationPortMock.getByFiscalCode.mockResolvedValueOnce(
      err(aNotFoundError),
    );

    expect(await logout(input)).toEqual(ok(undefined));
    expect(requestRevocation).not.toHaveBeenCalled();
    expect(mockDelete).toHaveBeenCalledExactlyOnceWith(
      aSessionWithHashedTokens,
    );
  });

  it("stops when retrieving Lollipop activation fails", async () => {
    lollipopActivationPortMock.getByFiscalCode.mockResolvedValueOnce(
      err(aGenericError),
    );

    expect(await logout(input)).toEqual(
      err(
        new GenericError(
          `Failed to retrieve previous lollipop activation data: ${aGenericError.message}`,
        ),
      ),
    );
    expect(mockDelete).not.toHaveBeenCalled();
    expect(invalidateSessionTokenCache).not.toHaveBeenCalled();
    expect(mockSendEvent).not.toHaveBeenCalled();
  });

  it("stops when revoking the Lollipop association fails", async () => {
    lollipopActivationPortMock.revokeByFiscalCode.mockResolvedValueOnce(
      err(aGenericError),
    );

    expect(await logout(input)).toEqual(
      err(
        new GenericError(
          `Failed to revoke the "fiscal code - lollipop" association: ${aGenericError.message}`,
        ),
      ),
    );
    expect(mockDelete).not.toHaveBeenCalled();
    expect(mockSendEvent).not.toHaveBeenCalled();
  });

  it.each([aGenericError, aNotFoundError])(
    "propagates session deletion errors without clearing cache or emitting an event: %s",
    async (error) => {
      mockDelete.mockResolvedValueOnce(err(error));

      expect(await logout(input)).toEqual(
        err(
          new GenericError(`Failed to delete user session: ${error.message}`),
        ),
      );
      expect(invalidateSessionTokenCache).not.toHaveBeenCalled();
      expect(mockSendEvent).not.toHaveBeenCalled();
    },
  );

  it("does not wait for public-key revocation or cache invalidation", async () => {
    requestRevocation.mockImplementationOnce(() => new Promise(() => {}));
    invalidateSessionTokenCache.mockImplementationOnce(
      () => new Promise(() => {}),
    );

    expect(await logout(input)).toEqual(ok(undefined));
    expect(mockSendEvent).toHaveBeenCalledOnce();
  });

  it("logs best-effort revocation and cache failures without failing logout", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    requestRevocation.mockResolvedValueOnce(err(aGenericError));
    invalidateSessionTokenCache.mockResolvedValueOnce(err(aGenericError));

    expect(await logout(input)).toEqual(ok(undefined));
    expect(consoleError).toHaveBeenCalledWith(
      `Failed to revoke lollipop: ${aGenericError.message}`,
    );
    expect(consoleError).toHaveBeenCalledWith(
      `Failed to invalidate session token cache: ${aGenericError.message}`,
    );
    expect(mockSendEvent).toHaveBeenCalledOnce();
  });

  it("returns an error when emitting the logout event fails", async () => {
    mockSendEvent.mockResolvedValueOnce(err(aGenericError));

    expect(await logout(input)).toEqual(
      err(
        new GenericError(
          `Failed to emit logout event: ${aGenericError.message}`,
        ),
      ),
    );
  });
});
