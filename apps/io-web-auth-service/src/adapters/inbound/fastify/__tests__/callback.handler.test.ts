import {
  ForbiddenError,
  GenericError,
  NonEmptyString,
} from "@pagopa/hexagonal-core";
import fastify from "fastify";
import { err, ok } from "neverthrow";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
    { error: new GenericError("Error while validating user"), status: 500 },
  ])(
    "returns HTTP $status instead of redirecting for $error.kind",
    async ({ error, status }) => {
      handleOidcCallbackUseCase.mockResolvedValueOnce(err(error));

      const response = await server.inject({
        method: "GET",
        url: `${callbackContract.path}?state=a-state&code=a-code&error=an-error`,
      });

      expect(handleOidcCallbackUseCase).toHaveBeenCalledExactlyOnceWith({
        callback: { state: "a-state", code: "a-code", error: "an-error" },
      });
      expect(response.statusCode).toBe(status);
      expect(response.json()).toMatchObject({ status });
      expect(response.headers.location).toBeUndefined();
    },
  );

  it("redirects a success outcome with the token in the URL fragment", async () => {
    handleOidcCallbackUseCase.mockResolvedValueOnce(
      ok({ outcome: "success", token: "a-token" as NonEmptyString }),
    );

    const response = await server.inject({
      method: "GET",
      url: `${callbackContract.path}?state=a-state&code=a-code&error=an-error`,
    });

    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe(
      "https://app.example.com/success#token=a-token",
    );
  });

  it("redirects an error outcome with error code and message", async () => {
    handleOidcCallbackUseCase.mockResolvedValueOnce(
      ok({
        outcome: "error",
        errorCode: 1002,
        errorMessage: "access_denied" as NonEmptyString,
      }),
    );

    const response = await server.inject({
      method: "GET",
      url: `${callbackContract.path}?state=a-state&error=access_denied&error_description=1002`,
    });

    expect(handleOidcCallbackUseCase).toHaveBeenCalledExactlyOnceWith({
      callback: {
        state: "a-state",
        error: "access_denied",
        error_description: "1002",
      },
    });
    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe(
      "https://app.example.com/error?errorCode=1002&errorMessage=access_denied",
    );
  });

  it("omits the error code from the redirect when it is not available", async () => {
    handleOidcCallbackUseCase.mockResolvedValueOnce(
      ok({
        outcome: "error",
        errorCode: undefined,
        errorMessage: "error occurred" as NonEmptyString,
      }),
    );

    const response = await server.inject({
      method: "GET",
      url: `${callbackContract.path}?state=a-state&error=access_denied`,
    });

    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe(
      "https://app.example.com/error?errorMessage=error+occurred",
    );
  });
});
