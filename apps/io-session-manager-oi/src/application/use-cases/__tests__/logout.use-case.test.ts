import { GenericError } from "@pagopa/hexagonal-core";
import { err, ok } from "neverthrow";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  AuthEventPortMock,
  mockSendEvent,
  resetAuthEventPortMock,
} from "../../../__mocks__/ports/auth-event-port.mock.js";
import {
  aBaseSession,
  aFiscalCode,
  aGenericError,
} from "../../../__mocks__/session.mocks.js";
import type { InvalidatePreviousUserStateUseCase } from "../invalidate-previous-user-state.use-case.js";
import { makeLogoutUseCase } from "../logout.use-case.js";

const invalidatePreviousUserState = vi.fn<InvalidatePreviousUserStateUseCase>();
const logout = makeLogoutUseCase({
  authEventPort: AuthEventPortMock,
  invalidatePreviousUserStateUseCase: invalidatePreviousUserState,
});

beforeEach(() => {
  resetAuthEventPortMock();
  invalidatePreviousUserState.mockReset().mockResolvedValue(ok(undefined));
});

describe("makeLogoutUseCase", () => {
  it("invalidates the user state before emitting an app logout event", async () => {
    const result = await logout({ session: aBaseSession });

    expect(result).toEqual(ok(undefined));
    expect(invalidatePreviousUserState).toHaveBeenCalledExactlyOnceWith(
      aFiscalCode,
    );
    expect(mockSendEvent).toHaveBeenCalledExactlyOnceWith({
      eventType: "logout",
      fiscalCode: aFiscalCode,
      scenario: "app",
      ts: expect.any(Date),
    });
    expect(
      invalidatePreviousUserState.mock.invocationCallOrder[0],
    ).toBeLessThan(mockSendEvent.mock.invocationCallOrder[0]);
  });

  it("propagates invalidation errors without emitting an event", async () => {
    invalidatePreviousUserState.mockResolvedValueOnce(err(aGenericError));

    const result = await logout({ session: aBaseSession });

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toBe(aGenericError);
    expect(mockSendEvent).not.toHaveBeenCalled();
  });

  it("returns an error when emitting the logout event fails", async () => {
    mockSendEvent.mockResolvedValueOnce(err(aGenericError));

    expect(await logout({ session: aBaseSession })).toEqual(
      err(
        new GenericError(
          `Failed to emit logout event: ${aGenericError.message}`,
        ),
      ),
    );
  });
});
