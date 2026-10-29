import {
  ForbiddenError,
  GenericError,
  NonEmptyStringSchema,
} from "@pagopa/hexagonal-core";
import fastify from "fastify";
import { err, ok } from "neverthrow";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TechnicalProfileLockedError } from "../../../../application/use-cases/validate-profile-locks.use-case.js";
import {
  callbackContract,
  type CallbackHandlerDeps,
  mountCallbackHandler,
} from "../callback.handler.js";

describe("callback handler login outcomes and errors", () => {
  let server: ReturnType<typeof fastify>;
  const handleOidcCallbackUseCase =
    vi.fn<CallbackHandlerDeps["handleOidcCallbackUseCase"]>();

  beforeEach(() => {
    handleOidcCallbackUseCase.mockReset();
    server = fastify();
    mountCallbackHandler(server, {
      handleOidcCallbackUseCase,
      loginSuccessRedirectUrl: "https://app.example.com/success",
      loginErrorRedirectUrl: "https://app.example.com/error",
    });
  });

  afterEach(async () => {
    await server.close();
  });

  it.each([
    { error: new ForbiddenError(), status: 403 },
    { error: new TechnicalProfileLockedError(), status: 403 },
    { error: new GenericError("Error while validating user"), status: 500 },
  ])(
    "returns HTTP $status instead of redirecting for $error.kind",
    async ({ error, status }) => {
      handleOidcCallbackUseCase.mockResolvedValueOnce(err(error));

      const response = await server.inject({
        method: "GET",
        url: `${callbackContract.path}?state=a-state&code=a-code`,
        headers: { "x-forwarded-for": "203.0.113.7" },
      });

      expect(handleOidcCallbackUseCase).toHaveBeenCalledExactlyOnceWith({
        callback: { state: "a-state", code: "a-code" },
        ipAddress: "203.0.113.7",
      });
      expect(response.statusCode).toBe(status);
      expect(response.json()).toMatchObject({ status });
      expect(response.headers.location).toBeUndefined();
    },
  );

  it("redirects a profile locked outcome with code 1002 and no error message", async () => {
    handleOidcCallbackUseCase.mockResolvedValueOnce(
      ok({
        outcome: "error",
        errorCode: NonEmptyStringSchema.parse("1002"),
      }),
    );

    const response = await server.inject({
      method: "GET",
      url: `${callbackContract.path}?state=a-state&code=a-code`,
      headers: { "x-forwarded-for": "203.0.113.7" },
    });

    expect(handleOidcCallbackUseCase).toHaveBeenCalledExactlyOnceWith({
      callback: { state: "a-state", code: "a-code" },
      ipAddress: "203.0.113.7",
    });
    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe(
      "https://app.example.com/error?errorCode=1002",
    );
  });
});
