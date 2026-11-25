import {
  ForbiddenError,
  GenericError,
  NonEmptyString,
  ValidationError,
} from "@pagopa/hexagonal-core";
import fastify from "fastify";
import { err, ok } from "neverthrow";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  callbackContract,
  type CallbackHandlerDeps,
  mountCallbackHandler,
} from "../callback.handler.js";
import { extractIpMiddleware } from "../middlewares/extract-ip.middleware.js";

const CLIENT_IP = "203.0.113.7";

describe("callback handler login outcomes and errors", () => {
  let server: ReturnType<typeof fastify>;
  const handleOidcCallbackUseCase =
    vi.fn<CallbackHandlerDeps["handleOidcCallbackUseCase"]>();

  beforeEach(() => {
    handleOidcCallbackUseCase.mockReset();
    server = fastify();
    mountCallbackHandler(server, {
      middlewares: [extractIpMiddleware] as const,
      handleOidcCallbackUseCase,
      loginSuccessRedirectUrl: "https://app.example.com/success",
      loginErrorRedirectUrl: "https://app.example.com/error",
    });
  });

  afterEach(async () => {
    await server.close();
  });

  it.each([
    {
      error: new ValidationError("Missing or expired login state"),
      status: 400,
    },
    { error: new ForbiddenError(), status: 403 },
    { error: new GenericError("Error while validating user"), status: 500 },
  ])(
    "returns HTTP $status instead of redirecting for $error.kind",
    async ({ error, status }) => {
      handleOidcCallbackUseCase.mockResolvedValueOnce(err(error));

      const response = await server.inject({
        method: "GET",
        headers: { "x-forwarded-for": CLIENT_IP },
        url: `${callbackContract.path}?state=a-state&error=an-error`,
      });

      expect(handleOidcCallbackUseCase).toHaveBeenCalledExactlyOnceWith({
        callback: { state: "a-state", error: "an-error" },
        ipAddress: CLIENT_IP,
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
      headers: { "x-forwarded-for": CLIENT_IP },
      url: `${callbackContract.path}?state=a-state&code=a-code`,
    });

    expect(response.statusCode).toBe(301);
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
      headers: { "x-forwarded-for": CLIENT_IP },
      url: `${callbackContract.path}?state=a-state&error=access_denied&error_description=1002`,
    });

    expect(handleOidcCallbackUseCase).toHaveBeenCalledExactlyOnceWith({
      callback: {
        state: "a-state",
        error: "access_denied",
        error_description: "1002",
      },
      ipAddress: CLIENT_IP,
    });
    expect(response.statusCode).toBe(301);
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
      headers: { "x-forwarded-for": CLIENT_IP },
      url: `${callbackContract.path}?state=a-state&error=access_denied`,
    });

    expect(response.statusCode).toBe(301);
    expect(response.headers.location).toBe(
      "https://app.example.com/error?errorMessage=error+occurred",
    );
  });

  it.each([
    "?code=a-code",
    "?state=",
    "?state=a-state&code=",
    "?state=a-state&error=",
    "?state=a-state&error=access_denied&error_description=",
  ])(
    "returns HTTP 400 without calling the use case for an invalid query (%s)",
    async (query) => {
      const response = await server.inject({
        method: "GET",
        headers: { "x-forwarded-for": CLIENT_IP },
        url: `${callbackContract.path}${query}`,
      });

      expect(handleOidcCallbackUseCase).not.toHaveBeenCalled();
      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({ status: 400 });
      expect(response.headers.location).toBeUndefined();
    },
  );

  it("returns HTTP 400 without calling the use case when the client IP is missing", async () => {
    const response = await server.inject({
      method: "GET",
      url: `${callbackContract.path}?state=a-state&code=a-code`,
    });

    expect(handleOidcCallbackUseCase).not.toHaveBeenCalled();
    expect(response.statusCode).toBe(400);
  });
});
