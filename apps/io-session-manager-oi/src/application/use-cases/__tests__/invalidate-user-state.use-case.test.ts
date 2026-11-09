import {
  type FiscalCode,
  GenericError,
  type UseCase,
} from "@pagopa/hexagonal-core";
import { LollipopAssertionRefSchema } from "@pagopa/io-auth-n-identity-domain";
import type { HashedSessionTokenWithSessionId } from "@pagopa/io-auth-n-identity-session";
import { err, ok } from "neverthrow";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { lollipopActivationPortMock } from "../../../__mocks__/ports/lollipop-activation-port.mock.js";
import {
  aFiscalCode,
  aGenericError,
  aHashedSessionTokenWithSessionId,
  aNotFoundError,
} from "../../../__mocks__/session.mocks.js";
import type { LollipopRevocationPort } from "../../../domain/ports/outbound/lollipop-revocation.port.js";
import type { InvalidateSessionTokenCacheUseCase } from "../invalidate-session-token-cache.use-case.js";
import { makeInvalidateUserStateUseCase } from "../invalidate-user-state.use-case.js";

const input = { fiscalCode: aFiscalCode };
const activation = {
  fiscalCode: aFiscalCode,
  assertionRef: LollipopAssertionRefSchema.parse(
    `sha256-${"a".repeat(43)}`,
  ),
  expirationDate: new Date("2100-01-01"),
};
const requestRevocation =
  vi.fn<LollipopRevocationPort["requestRevocation"]>();
const invalidateSessionTokenCache =
  vi.fn<InvalidateSessionTokenCacheUseCase>();
const invalidateSession =
  vi.fn<
    UseCase<
      { fiscalCode: FiscalCode },
      HashedSessionTokenWithSessionId | undefined,
      GenericError
    >
  >();
const invalidateUserState = makeInvalidateUserStateUseCase({
  lollipopActivationPort: lollipopActivationPortMock,
  lollipopRevocationPort: { requestRevocation },
  invalidateSessionTokenCacheUseCase: invalidateSessionTokenCache,
  invalidateSession,
});

beforeEach(() => {
  lollipopActivationPortMock.getByFiscalCode
    .mockReset()
    .mockResolvedValue(ok(activation));
  lollipopActivationPortMock.revokeByFiscalCode
    .mockReset()
    .mockResolvedValue(ok(undefined));
  requestRevocation.mockReset().mockResolvedValue(ok(undefined));
  invalidateSession
    .mockReset()
    .mockResolvedValue(ok(aHashedSessionTokenWithSessionId));
  invalidateSessionTokenCache.mockReset().mockResolvedValue(ok(undefined));
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("makeInvalidateUserStateUseCase", () => {
  it("revokes Lollipop, invokes the session strategy with the original input and clears the returned token cache", async () => {
    expect(await invalidateUserState(input)).toEqual(ok(undefined));
    expect(
      lollipopActivationPortMock.getByFiscalCode,
    ).toHaveBeenCalledExactlyOnceWith(aFiscalCode);
    expect(requestRevocation).toHaveBeenCalledExactlyOnceWith(
      activation.assertionRef,
    );
    expect(
      lollipopActivationPortMock.revokeByFiscalCode,
    ).toHaveBeenCalledExactlyOnceWith(aFiscalCode);
    expect(invalidateSession).toHaveBeenCalledExactlyOnceWith(input);
    expect(invalidateSession.mock.calls[0][0]).toBe(input);
    expect(invalidateSessionTokenCache).toHaveBeenCalledExactlyOnceWith(
      aHashedSessionTokenWithSessionId,
    );
    expect(requestRevocation.mock.invocationCallOrder[0]).toBeLessThan(
      lollipopActivationPortMock.revokeByFiscalCode.mock
        .invocationCallOrder[0],
    );
    expect(
      lollipopActivationPortMock.revokeByFiscalCode.mock
        .invocationCallOrder[0],
    ).toBeLessThan(invalidateSession.mock.invocationCallOrder[0]);
    expect(invalidateSession.mock.invocationCallOrder[0]).toBeLessThan(
      invalidateSessionTokenCache.mock.invocationCallOrder[0],
    );
  });

  it("continues with association revocation and session invalidation when no activation exists", async () => {
    lollipopActivationPortMock.getByFiscalCode.mockResolvedValueOnce(
      err(aNotFoundError),
    );

    expect(await invalidateUserState(input)).toEqual(ok(undefined));
    expect(requestRevocation).not.toHaveBeenCalled();
    expect(
      lollipopActivationPortMock.revokeByFiscalCode,
    ).toHaveBeenCalledExactlyOnceWith(aFiscalCode);
    expect(invalidateSession).toHaveBeenCalledExactlyOnceWith(input);
    expect(invalidateSessionTokenCache).toHaveBeenCalledOnce();
  });

  it("stops the workflow when activation retrieval fails", async () => {
    lollipopActivationPortMock.getByFiscalCode.mockResolvedValueOnce(
      err(aGenericError),
    );

    expect(await invalidateUserState(input)).toEqual(
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
    expect(invalidateSession).not.toHaveBeenCalled();
    expect(invalidateSessionTokenCache).not.toHaveBeenCalled();
  });

  it("stops before invoking the session strategy when association revocation fails", async () => {
    lollipopActivationPortMock.revokeByFiscalCode.mockResolvedValueOnce(
      err(aGenericError),
    );

    expect(await invalidateUserState(input)).toEqual(
      err(
        new GenericError(
          `Failed to revoke the "fiscal code - lollipop" association: ${aGenericError.message}`,
        ),
      ),
    );
    expect(invalidateSession).not.toHaveBeenCalled();
    expect(invalidateSessionTokenCache).not.toHaveBeenCalled();
  });

  it("propagates the session strategy error without invalidating the cache", async () => {
    invalidateSession.mockResolvedValueOnce(err(aGenericError));

    const result = await invalidateUserState(input);

    expect(result._unsafeUnwrapErr()).toBe(aGenericError);
    expect(invalidateSessionTokenCache).not.toHaveBeenCalled();
  });

  it("skips cache invalidation when the strategy returns no session", async () => {
    invalidateSession.mockResolvedValueOnce(ok(undefined));

    expect(await invalidateUserState(input)).toEqual(ok(undefined));
    expect(invalidateSession).toHaveBeenCalledExactlyOnceWith(input);
    expect(invalidateSessionTokenCache).not.toHaveBeenCalled();
  });

  it("waits for session invalidation before clearing the cache and returning success", async () => {
    const completeInvalidation = vi.fn<() => void>();
    const pending = new Promise<
      Awaited<ReturnType<typeof invalidateSession>>
    >((resolve) => {
      completeInvalidation.mockImplementation(() =>
        resolve(ok(aHashedSessionTokenWithSessionId)),
      );
    });
    invalidateSession.mockReturnValueOnce(pending);
    const completed = vi.fn();
    const execution = invalidateUserState(input).then(completed);

    await vi.waitFor(() =>
      expect(invalidateSession).toHaveBeenCalledOnce(),
    );
    expect(invalidateSessionTokenCache).not.toHaveBeenCalled();
    expect(completed).not.toHaveBeenCalled();

    completeInvalidation();
    await execution;

    expect(invalidateSessionTokenCache).toHaveBeenCalledExactlyOnceWith(
      aHashedSessionTokenWithSessionId,
    );
    expect(completed).toHaveBeenCalledExactlyOnceWith(ok(undefined));
  });

  it("does not wait for public-key revocation or cache invalidation", async () => {
    requestRevocation.mockImplementationOnce(() => new Promise(() => {}));
    invalidateSessionTokenCache.mockImplementationOnce(
      () => new Promise(() => {}),
    );

    expect(await invalidateUserState(input)).toEqual(ok(undefined));
    expect(invalidateSession).toHaveBeenCalledExactlyOnceWith(input);
    expect(invalidateSessionTokenCache).toHaveBeenCalledOnce();
  });

  it("logs best-effort errors without failing the workflow", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    requestRevocation.mockResolvedValueOnce(err(aGenericError));
    invalidateSessionTokenCache.mockResolvedValueOnce(err(aGenericError));

    expect(await invalidateUserState(input)).toEqual(ok(undefined));
    expect(consoleError).toHaveBeenCalledTimes(2);
    expect(consoleError).toHaveBeenCalledWith(
      `Failed to revoke lollipop: ${aGenericError.message}`,
    );
    expect(consoleError).toHaveBeenCalledWith(
      `Failed to invalidate session token cache: ${aGenericError.message}`,
    );
  });
});
