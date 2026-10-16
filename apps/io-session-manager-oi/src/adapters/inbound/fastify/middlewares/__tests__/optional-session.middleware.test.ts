import { AuthenticationError } from "@pagopa/hexagonal-core";
import { err, ok } from "neverthrow";
import { describe, expect, it, vi } from "vitest";

import {
  aBaseSession,
  aPlainSessionToken,
  aSessionId,
} from "../../../../../__mocks__/session.mocks.js";
import type { AuthenticationMiddleware } from "../../../../../middlewares/authentication/index.js";
import { optionalSessionMiddleware } from "../optional-session.middleware.js";

describe("optionalSessionMiddleware", () => {
  it("continues anonymously when no Authorization header is present", async () => {
    const authenticateSession =
      vi.fn() as unknown as AuthenticationMiddleware<"session">;
    const middleware = optionalSessionMiddleware(authenticateSession);

    const result = await middleware({ context: {}, payload: { headers: {} } });

    expect(result).toEqual(ok({}));
    expect(authenticateSession).not.toHaveBeenCalled();
  });

  it("introspects and returns the session when Authorization is present", async () => {
    const sessionContext = {
      session: aBaseSession,
      sessionId: aSessionId,
      sessionToken: aPlainSessionToken,
    };
    const authenticateSession = vi
      .fn()
      .mockResolvedValueOnce(
        ok(sessionContext),
      ) as unknown as AuthenticationMiddleware<"session">;
    const middleware = optionalSessionMiddleware(authenticateSession);
    const payload = { headers: { authorization: "Bearer token" } };

    const result = await middleware({ context: {}, payload });

    expect(result).toEqual(ok(sessionContext));
    expect(authenticateSession).toHaveBeenCalledExactlyOnceWith({
      context: {},
      payload,
    });
  });

  it("continues anonymously in case of an invalid session token", async () => {
    const authenticationError = new AuthenticationError();
    const authenticateSession = vi
      .fn()
      .mockResolvedValueOnce(
        err(authenticationError),
      ) as unknown as AuthenticationMiddleware<"session">;
    const middleware = optionalSessionMiddleware(authenticateSession);
    const payload = { headers: { authorization: "Bearer token" } };

    const result = await middleware({
      context: {},
      payload,
    });

    expect(result).toEqual(ok({}));
    expect(authenticateSession).toHaveBeenCalledExactlyOnceWith({
      context: {},
      payload,
    });
  });
});
