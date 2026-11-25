import {
  AuthenticationError,
  FiscalCode,
  ForbiddenError,
  NonEmptyString,
} from "@pagopa/hexagonal-core";
import fastify from "fastify";
import { err, ok } from "neverthrow";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  introspectContract,
  type IntrospectHandlerDeps,
  mountIntrospectHandler,
} from "../introspect.handler.js";

const aUser = {
  name: "Mario" as NonEmptyString,
  family_name: "Rossi" as NonEmptyString,
  fiscal_number: "AAAAAA00A00A000A" as FiscalCode,
  spid_level: "https://www.spid.gov.it/SpidL2" as const,
};

describe("introspect handler", () => {
  const introspectionUseCase =
    vi.fn<IntrospectHandlerDeps["introspectionUseCase"]>();
  const server = fastify();
  mountIntrospectHandler(server, { introspectionUseCase });

  const inject = (payload: unknown) =>
    server.inject({
      method: "POST",
      url: introspectContract.path,
      payload: payload as object,
    });

  beforeEach(() => {
    introspectionUseCase.mockReset();
  });

  it("maps the body token to the use case input and returns the active response", async () => {
    introspectionUseCase.mockResolvedValueOnce(
      ok({ active: true, user: aUser }),
    );

    const response = await inject({ token: "a-token" });

    expect(introspectionUseCase).toHaveBeenCalledExactlyOnceWith({
      token: "a-token",
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ active: true, user: aUser });
  });

  it("returns 403 with active=false for a forbidden error", async () => {
    introspectionUseCase.mockResolvedValueOnce(err(new ForbiddenError()));

    const response = await inject({ token: "a-token" });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ status: 403, active: false });
  });

  it("returns 401 for an authentication error", async () => {
    introspectionUseCase.mockResolvedValueOnce(err(new AuthenticationError()));

    const response = await inject({ token: "a-token" });

    expect(response.statusCode).toBe(401);
  });

  it("returns 400 when the token is missing", async () => {
    const response = await inject({});

    expect(response.statusCode).toBe(400);
    expect(introspectionUseCase).not.toHaveBeenCalled();
  });
});
