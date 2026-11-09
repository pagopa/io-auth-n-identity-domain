import { AuthenticationError } from "@pagopa/hexagonal-core";
import fastify from "fastify";
import { err, ok } from "neverthrow";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  aBaseSession,
  aGenericError,
  aPlainSessionToken,
  aSessionId,
} from "../../../../__mocks__/session.mocks.js";
import type { LogoutUseCase } from "../../../../application/use-cases/logout.use-case.js";
import type { AuthenticationMiddleware } from "../../../../middlewares/authentication/index.js";
import { logoutRoute, mountLogoutHandler } from "../logout.handler.js";

describe("logout handler", () => {
  let server: ReturnType<typeof fastify>;
  const authenticate = vi.fn<AuthenticationMiddleware<"session">>();
  const logout = vi.fn<LogoutUseCase>();

  beforeEach(() => {
    authenticate.mockReset().mockResolvedValue(
      ok({
        session: aBaseSession,
        sessionId: aSessionId,
        sessionToken: aPlainSessionToken,
      }),
    );
    logout.mockReset().mockResolvedValue(ok(undefined));
    server = fastify();
    mountLogoutHandler({
      middlewares: [authenticate],
      useCase: logout,
    })(server);
  });

  afterEach(async () => {
    await server.close();
  });

  it("passes the authenticated session to the use case and returns success", async () => {
    const response = await server.inject({
      method: "POST",
      url: logoutRoute.path,
    });

    expect(logout).toHaveBeenCalledExactlyOnceWith({
      session: aBaseSession,
      sessionToken: aPlainSessionToken,
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ message: "ok" });
  });

  it("rejects unauthenticated requests without calling logout", async () => {
    authenticate.mockResolvedValueOnce(err(new AuthenticationError()));

    const response = await server.inject({
      method: "POST",
      url: logoutRoute.path,
    });

    expect(response.statusCode).toBe(401);
    expect(logout).not.toHaveBeenCalled();
  });

  it("returns an internal error when logout fails", async () => {
    logout.mockResolvedValueOnce(err(aGenericError));

    const response = await server.inject({
      method: "POST",
      url: logoutRoute.path,
    });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toMatchObject({ status: 500 });
  });
});
