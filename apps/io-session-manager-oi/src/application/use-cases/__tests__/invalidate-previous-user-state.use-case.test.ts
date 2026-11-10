import { GenericError } from "@pagopa/hexagonal-core";
import { LollipopAssertionRefSchema } from "@pagopa/io-auth-n-identity-domain";
import { err, ok } from "neverthrow";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { lollipopActivationPortMock } from "../../../__mocks__/ports/lollipop-activation-port.mock.js";
import {
  mockDelete,
  mockInvalidatePreviousSession,
  resetSessionPortMock,
  SessionPortMock,
} from "../../../__mocks__/ports/session-port.mock.js";
import {
  aFiscalCode,
  aGenericError,
  aHashedSessionTokenWithSessionId,
  aNotFoundError,
} from "../../../__mocks__/session.mocks.js";
import type { LollipopRevocationPort } from "../../../domain/ports/outbound/lollipop-revocation.port.js";
import { makeInvalidatePreviousUserStateUseCase } from "../invalidate-previous-user-state.use-case.js";
import type { InvalidateSessionTokenCacheUseCase } from "../invalidate-session-token-cache.use-case.js";

const assertionRef = LollipopAssertionRefSchema.parse(
  `sha256-${"a".repeat(43)}`,
);
const requestRevocation = vi.fn<LollipopRevocationPort["requestRevocation"]>();
const invalidateSessionTokenCache = vi.fn<InvalidateSessionTokenCacheUseCase>();
const invalidatePreviousUserState = makeInvalidatePreviousUserStateUseCase({
  sessionPort: SessionPortMock,
  lollipopActivationPort: lollipopActivationPortMock,
  lollipopRevocationPort: { requestRevocation },
  invalidateSessionTokenCacheUseCase: invalidateSessionTokenCache,
});

beforeEach(() => {
  resetSessionPortMock();
  mockInvalidatePreviousSession.mockResolvedValue(
    ok(aHashedSessionTokenWithSessionId),
  );
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

describe("makeInvalidatePreviousUserStateUseCase", () => {
  it("revokes Lollipop, invalidates the session, then clears the token cache", async () => {
    const result = await invalidatePreviousUserState(aFiscalCode);

    expect(result).toEqual(ok(undefined));
    expect(
      lollipopActivationPortMock.getByFiscalCode,
    ).toHaveBeenCalledExactlyOnceWith(aFiscalCode);
    expect(requestRevocation).toHaveBeenCalledExactlyOnceWith(assertionRef);
    expect(
      lollipopActivationPortMock.revokeByFiscalCode,
    ).toHaveBeenCalledExactlyOnceWith(aFiscalCode);
    expect(mockInvalidatePreviousSession).toHaveBeenCalledExactlyOnceWith(
      aFiscalCode,
    );
    expect(mockDelete).not.toHaveBeenCalled();
    expect(invalidateSessionTokenCache).toHaveBeenCalledExactlyOnceWith(
      aHashedSessionTokenWithSessionId,
    );
    expect(requestRevocation.mock.invocationCallOrder[0]).toBeLessThan(
      lollipopActivationPortMock.revokeByFiscalCode.mock.invocationCallOrder[0],
    );
    expect(
      lollipopActivationPortMock.revokeByFiscalCode.mock.invocationCallOrder[0],
    ).toBeLessThan(mockInvalidatePreviousSession.mock.invocationCallOrder[0]);
    expect(
      mockInvalidatePreviousSession.mock.invocationCallOrder[0],
    ).toBeLessThan(invalidateSessionTokenCache.mock.invocationCallOrder[0]);
  });

  it("continues without a public-key revocation when no activation exists", async () => {
    lollipopActivationPortMock.getByFiscalCode.mockResolvedValueOnce(
      err(aNotFoundError),
    );

    expect(await invalidatePreviousUserState(aFiscalCode)).toEqual(
      ok(undefined),
    );
    expect(requestRevocation).not.toHaveBeenCalled();
    expect(
      lollipopActivationPortMock.revokeByFiscalCode,
    ).toHaveBeenCalledExactlyOnceWith(aFiscalCode);
    expect(mockInvalidatePreviousSession).toHaveBeenCalledOnce();
    expect(invalidateSessionTokenCache).toHaveBeenCalledOnce();
  });

  it("skips cache invalidation when no previous session exists", async () => {
    mockInvalidatePreviousSession.mockResolvedValueOnce(ok(undefined));

    expect(await invalidatePreviousUserState(aFiscalCode)).toEqual(
      ok(undefined),
    );
    expect(invalidateSessionTokenCache).not.toHaveBeenCalled();
  });

  it("does not wait for public-key revocation", async () => {
    requestRevocation.mockImplementationOnce(() => new Promise(() => {}));

    expect(await invalidatePreviousUserState(aFiscalCode)).toEqual(
      ok(undefined),
    );
    expect(invalidateSessionTokenCache).toHaveBeenCalledOnce();
  });

  it("logs public-key revocation failures and continues invalidation", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    requestRevocation.mockResolvedValueOnce(err(aGenericError));

    expect(await invalidatePreviousUserState(aFiscalCode)).toEqual(
      ok(undefined),
    );
    expect(consoleError).toHaveBeenCalledExactlyOnceWith(
      `Failed to revoke lollipop: ${aGenericError.message}`,
    );
    expect(invalidateSessionTokenCache).toHaveBeenCalledOnce();
  });

  it("stops when retrieving the Lollipop activation fails", async () => {
    lollipopActivationPortMock.getByFiscalCode.mockResolvedValueOnce(
      err(aGenericError),
    );

    expect(await invalidatePreviousUserState(aFiscalCode)).toEqual(
      err(
        new GenericError(
          `Failed to retrieve previous lollipop activation data: ${aGenericError.message}`,
        ),
      ),
    );
    expect(requestRevocation).not.toHaveBeenCalled();
    expect(
      lollipopActivationPortMock.revokeByFiscalCode,
    ).not.toHaveBeenCalled();
    expect(mockInvalidatePreviousSession).not.toHaveBeenCalled();
    expect(invalidateSessionTokenCache).not.toHaveBeenCalled();
  });

  it("stops when revoking the Lollipop association fails", async () => {
    lollipopActivationPortMock.revokeByFiscalCode.mockResolvedValueOnce(
      err(aGenericError),
    );

    expect(await invalidatePreviousUserState(aFiscalCode)).toEqual(
      err(
        new GenericError(
          `Failed to revoke the "fiscal code - lollipop" association: ${aGenericError.message}`,
        ),
      ),
    );
    expect(mockInvalidatePreviousSession).not.toHaveBeenCalled();
    expect(invalidateSessionTokenCache).not.toHaveBeenCalled();
  });

  it("stops when session invalidation fails", async () => {
    mockInvalidatePreviousSession.mockResolvedValueOnce(err(aGenericError));

    expect(await invalidatePreviousUserState(aFiscalCode)).toEqual(
      err(
        new GenericError(
          `Failed to invalidate previous sessions: ${aGenericError.message}`,
        ),
      ),
    );
    expect(invalidateSessionTokenCache).not.toHaveBeenCalled();
  });

  it("does not wait for session token cache invalidation", async () => {
    invalidateSessionTokenCache.mockImplementationOnce(
      () => new Promise(() => {}),
    );

    expect(await invalidatePreviousUserState(aFiscalCode)).toEqual(
      ok(undefined),
    );
    expect(invalidateSessionTokenCache).toHaveBeenCalledExactlyOnceWith(
      aHashedSessionTokenWithSessionId,
    );
  });

  it("logs cache invalidation errors without failing user state invalidation", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    invalidateSessionTokenCache.mockResolvedValueOnce(err(aGenericError));

    const result = await invalidatePreviousUserState(aFiscalCode);

    expect(result).toEqual(ok(undefined));
    expect(invalidateSessionTokenCache).toHaveBeenCalledExactlyOnceWith(
      aHashedSessionTokenWithSessionId,
    );
    expect(consoleError).toHaveBeenCalledExactlyOnceWith(
      `Failed to invalidate session token cache: ${aGenericError.message}`,
    );
  });
});
