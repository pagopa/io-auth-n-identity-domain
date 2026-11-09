import { GenericError } from "@pagopa/hexagonal-core";
import {
  toHashedSessionTokens,
  type SessionWithHashedSSOTokens,
} from "@pagopa/io-auth-n-identity-session/entities";
import {
  PlainSessionTokenSchema,
  SessionIdSchema,
} from "@pagopa/io-auth-n-identity-session/value-objects";
import { err, ok } from "neverthrow";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
  aSessionWithHashedTokens,
  aSessionWithPlainSSOTokens,
} from "../../../__mocks__/session.mocks.js";
import type { LollipopRevocationPort } from "../../../domain/ports/outbound/lollipop-revocation.port.js";
import { makeInvalidateProvidedUserStateUseCase } from "../invalidate-provided-user-state.use-case.js";
import type { InvalidateSessionTokenCacheUseCase } from "../invalidate-session-token-cache.use-case.js";

const requestRevocation =
  vi.fn<LollipopRevocationPort["requestRevocation"]>();
const invalidateSessionTokenCache =
  vi.fn<InvalidateSessionTokenCacheUseCase>();
const invalidateProvidedUserState = makeInvalidateProvidedUserStateUseCase(
  {
    sessionPort: SessionPortMock,
    lollipopActivationPort: lollipopActivationPortMock,
    lollipopRevocationPort: { requestRevocation },
    invalidateSessionTokenCacheUseCase: invalidateSessionTokenCache,
  },
);

beforeEach(() => {
  resetSessionPortMock();
  mockDelete.mockResolvedValue(ok(undefined));
  lollipopActivationPortMock.getByFiscalCode
    .mockReset()
    .mockResolvedValue(err(aNotFoundError));
  lollipopActivationPortMock.revokeByFiscalCode
    .mockReset()
    .mockResolvedValue(ok(undefined));
  requestRevocation.mockReset().mockResolvedValue(ok(undefined));
  invalidateSessionTokenCache.mockReset().mockResolvedValue(ok(undefined));
});

describe("makeInvalidateProvidedUserStateUseCase", () => {
  it("deletes the authenticated session rather than invalidating the user's current session", async () => {
    expect(
      await invalidateProvidedUserState(aSessionWithHashedTokens),
    ).toEqual(ok(undefined));
    expect(
      lollipopActivationPortMock.getByFiscalCode,
    ).toHaveBeenCalledExactlyOnceWith(aFiscalCode);
    expect(mockDelete).toHaveBeenCalledExactlyOnceWith(
      aSessionWithHashedTokens,
    );
    expect(mockDelete.mock.calls[0][0]).toBe(aSessionWithHashedTokens);
    expect(mockInvalidatePreviousSession).not.toHaveBeenCalled();
    expect(invalidateSessionTokenCache).toHaveBeenCalledExactlyOnceWith(
      aHashedSessionTokenWithSessionId,
    );
    expect(
      lollipopActivationPortMock.revokeByFiscalCode.mock
        .invocationCallOrder[0],
    ).toBeLessThan(mockDelete.mock.invocationCallOrder[0]);
    expect(mockDelete.mock.invocationCallOrder[0]).toBeLessThan(
      invalidateSessionTokenCache.mock.invocationCallOrder[0],
    );
  });

  it("invalidates only the cache entry belonging to the supplied session", async () => {
    const session: SessionWithHashedSSOTokens = toHashedSessionTokens({
      ...aSessionWithPlainSSOTokens,
      sessionId: SessionIdSchema.parse("anotherSessionId"),
      plainSessionToken: PlainSessionTokenSchema.parse(
        "anotherPlainSessionToken",
      ),
    });

    expect(await invalidateProvidedUserState(session)).toEqual(
      ok(undefined),
    );
    expect(mockDelete).toHaveBeenCalledExactlyOnceWith(session);
    expect(mockInvalidatePreviousSession).not.toHaveBeenCalled();
    expect(invalidateSessionTokenCache).toHaveBeenCalledExactlyOnceWith({
      sessionId: session.sessionId,
      hashedSessionToken: session.hashedSessionToken,
    });
  });

  it.each([aGenericError, aNotFoundError])(
    "wraps session deletion errors without clearing the cache: %s",
    async (error) => {
      mockDelete.mockResolvedValueOnce(err(error));

      expect(
        await invalidateProvidedUserState(aSessionWithHashedTokens),
      ).toEqual(
        err(
          new GenericError(
            `Failed to delete user session: ${error.message}`,
          ),
        ),
      );
      expect(mockDelete).toHaveBeenCalledExactlyOnceWith(
        aSessionWithHashedTokens,
      );
      expect(mockInvalidatePreviousSession).not.toHaveBeenCalled();
      expect(invalidateSessionTokenCache).not.toHaveBeenCalled();
    },
  );

  it("does not delete the session if the shared Lollipop workflow fails", async () => {
    lollipopActivationPortMock.revokeByFiscalCode.mockResolvedValueOnce(
      err(aGenericError),
    );

    expect(
      await invalidateProvidedUserState(aSessionWithHashedTokens),
    ).toEqual(
      err(
        new GenericError(
          `Failed to revoke the "fiscal code - lollipop" association: ${aGenericError.message}`,
        ),
      ),
    );
    expect(mockDelete).not.toHaveBeenCalled();
    expect(mockInvalidatePreviousSession).not.toHaveBeenCalled();
    expect(invalidateSessionTokenCache).not.toHaveBeenCalled();
  });
});
