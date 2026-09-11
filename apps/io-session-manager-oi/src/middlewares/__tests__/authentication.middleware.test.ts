import { AuthenticationError, GenericError } from "@pagopa/hexagonal-core";
import { toHashedSessionToken } from "@pagopa/io-auth-n-identity-session";
import { err, ok } from "neverthrow";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockFindBySessionToken,
  SessionPortMock,
} from "../../__mocks__/ports/session-port.mock.js";
import {
  aClientSessionToken,
  aGenericError,
  aNotFoundError,
  aPlainSessionToken,
  aSessionId,
  aSessionWithHashedTokens,
} from "../../__mocks__/session.mocks.js";
import { authenticate } from "../authentication.middleware.js";

const invoke = (headers: unknown) =>
  authenticate({ sessionPort: SessionPortMock })({
    context: {},
    payload: { headers },
  });

describe("authenticate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it.each([
    undefined,
    {},
    { authorization: "aPlainSessionToken" },
    { authorization: "Bearer" },
    { authorization: "Bearer " },
    { authorization: "Bearer aSessionId" },
    { authorization: "Bearer .aPlainSessionToken" },
    { authorization: "Bearer aSessionId." },
    { authorization: "Bearer aSessionId.aPlainSessionToken.extra" },
    { authorization: "bearer aSessionId.aPlainSessionToken" },
    { authorization: "Basic aSessionId.aPlainSessionToken" },
  ])("returns AuthenticationError for invalid headers: %o", async (headers) => {
    const result = await invoke(headers);

    expect(result).toEqual(err(new AuthenticationError()));
    expect(mockFindBySessionToken).not.toHaveBeenCalled();
  });

  it("returns AuthenticationError when the session cannot be found", async () => {
    mockFindBySessionToken.mockResolvedValueOnce(err(aNotFoundError));

    const result = await invoke({
      authorization: `Bearer ${aClientSessionToken}`,
    });

    expect(result).toEqual(err(new AuthenticationError()));
    expect(mockFindBySessionToken).toHaveBeenCalledExactlyOnceWith({
      sessionId: aSessionId,
      hashedSessionToken: toHashedSessionToken(aPlainSessionToken),
    });
  });

  it("returns a GenericError when retrieving the session fails", async () => {
    mockFindBySessionToken.mockResolvedValueOnce(err(aGenericError));

    const result = await invoke({
      authorization: `Bearer ${aClientSessionToken}`,
    });

    expect(result).toEqual(
      err(new GenericError("An error occurred while retrieving the session")),
    );
  });

  it("returns the authenticated session and parsed tokens", async () => {
    mockFindBySessionToken.mockResolvedValueOnce(ok(aSessionWithHashedTokens));

    const result = await invoke({
      authorization: `Bearer ${aClientSessionToken}`,
    });

    expect(result).toEqual(
      ok({
        session: aSessionWithHashedTokens,
        sessionId: aSessionId,
        sessionToken: aPlainSessionToken,
      }),
    );
    expect(mockFindBySessionToken).toHaveBeenCalledExactlyOnceWith({
      sessionId: aSessionId,
      hashedSessionToken: toHashedSessionToken(aPlainSessionToken),
    });
  });
});
