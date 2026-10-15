import { AuthenticationError } from "@pagopa/hexagonal-core";
import { err, ok } from "neverthrow";
import { describe, expect, it, vi } from "vitest";

import {
  aBaseSession,
  aPlainSessionToken,
  aSessionId,
} from "../../../../../__mocks__/session.mocks.js";
import type { AuthenticationMiddleware } from "../../../../../middlewares/authentication/index.js";
import { withOptionalUserMiddleware } from "../with-optional-user.middleware.js";

describe("withOptionalUserMiddleware", () => {
  it("continues anonymously when no Authorization header is present", async () => {
    const authenticateSession =
      vi.fn() as unknown as AuthenticationMiddleware<"session">;
    const middleware = withOptionalUserMiddleware(authenticateSession);

    const result = await middleware({ context: {}, payload: { headers: {} } });

    expect(result).toEqual(ok({ authenticated: false }));
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
    const middleware = withOptionalUserMiddleware(authenticateSession);
    const payload = { headers: { authorization: "Bearer token" } };

    const result = await middleware({ context: {}, payload });

    expect(result).toEqual(ok({ authenticated: true, value: sessionContext }));
    expect(authenticateSession).toHaveBeenCalledExactlyOnceWith({
      context: {},
      payload,
    });
  });

  it("rejects an invalid supplied session token", async () => {
    const authenticationError = new AuthenticationError();
    const authenticateSession = vi
      .fn()
      .mockResolvedValueOnce(
        err(authenticationError),
      ) as unknown as AuthenticationMiddleware<"session">;
    const middleware = withOptionalUserMiddleware(authenticateSession);

    const result = await middleware({
      context: {},
      payload: { headers: { authorization: "Bearer invalid" } },
    });

    expect(result).toEqual(err(authenticationError));
  });
});
