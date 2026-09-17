import { AuthenticationError } from "@pagopa/hexagonal-core";
import { err, ok } from "neverthrow";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  aBaseSession,
  aPlainSessionToken,
  aSessionId,
} from "../../../__mocks__/session.mocks.js";
import type { AuthToken } from "../auth-token.js";
import {
  AuthenticationMiddlewareFactory,
  makeAuthenticationMiddleware,
} from "../authentication.middleware.js";
import type { TokenIntrospectionStrategyFactory } from "../factories/token-introspection.factory.js";
import type { BearerTokenParsingStrategyFactory } from "../factories/token-parsing.factory.js";
import type { TokenIntrospectionStrategy } from "../strategies/token-introspection.strategy.js";
import type { BearerTokenParsingStrategy } from "../strategies/token-parsing.strategy.js";

describe("AuthenticationMiddleware", () => {
  const parsedToken: AuthToken["session"]["type"] = aPlainSessionToken;
  const parse = vi.fn();
  const resolve = vi.fn();
  const bearerTokenParsingStrategy = {
    parse,
  } as unknown as BearerTokenParsingStrategy<"session">;
  const tokenIntrospectionStrategy = {
    resolve,
  } as unknown as TokenIntrospectionStrategy<"session">;
  const middleware = makeAuthenticationMiddleware(
    bearerTokenParsingStrategy,
    tokenIntrospectionStrategy,
  );

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns an AuthenticationError when the bearer token cannot be parsed", async () => {
    // given
    const authenticationError = new AuthenticationError();
    parse.mockReturnValueOnce(err(authenticationError));

    // when
    const result = await middleware({
      context: {},
      payload: { headers: { authorization: "invalid" } },
    });

    // then
    expect(result).toEqual(err(authenticationError));
    expect(parse).toHaveBeenCalledExactlyOnceWith("invalid");
    expect(resolve).not.toHaveBeenCalled();
  });

  it("returns an AuthenticationError when session introspection fails", async () => {
    // given
    const authenticationError = new AuthenticationError();
    parse.mockReturnValueOnce(
      ok({ sessionId: aSessionId, sessionToken: parsedToken }),
    );
    resolve.mockResolvedValueOnce(err(authenticationError));

    // when
    const result = await middleware({
      context: {},
      payload: { headers: { authorization: "Bearer token" } },
    });

    // then
    expect(result).toEqual(err(authenticationError));
    expect(parse).toHaveBeenCalledExactlyOnceWith("Bearer token");
    expect(resolve).toHaveBeenCalledExactlyOnceWith(aSessionId, parsedToken);
  });

  it("returns the authenticated session and token context", async () => {
    // given
    parse.mockReturnValueOnce(
      ok({ sessionId: aSessionId, sessionToken: parsedToken }),
    );
    resolve.mockResolvedValueOnce(ok(aBaseSession));

    // when
    const result = await middleware({
      context: {},
      payload: { headers: { authorization: "Bearer token" } },
    });

    // then
    expect(result).toEqual(
      ok({
        session: aBaseSession,
        sessionId: aSessionId,
        sessionToken: parsedToken,
      }),
    );
    expect(parse).toHaveBeenCalledExactlyOnceWith("Bearer token");
    expect(resolve).toHaveBeenCalledExactlyOnceWith(aSessionId, parsedToken);
  });

  it("uses an empty authorization value when headers are missing", async () => {
    // given
    parse.mockReturnValueOnce(err(new AuthenticationError()));

    // when
    await middleware({ context: {}, payload: {} });

    // then
    expect(parse).toHaveBeenCalledExactlyOnceWith("");
  });
});

describe("AuthenticationMiddlewareFactory", () => {
  it.each(["session", "bpd"] as const)(
    "creates middleware with strategies for %s tokens",
    (tokenType) => {
      // given
      const parsingStrategy = {} as BearerTokenParsingStrategy<
        typeof tokenType
      >;
      const introspectionStrategy = {} as TokenIntrospectionStrategy<
        typeof tokenType
      >;
      const bearerTokenParsingStrategyFactory = {
        create: vi.fn().mockReturnValue(parsingStrategy),
      } as unknown as BearerTokenParsingStrategyFactory;
      const tokenIntrospectionStrategyFactory = {
        create: vi.fn().mockReturnValue(introspectionStrategy),
      } as unknown as TokenIntrospectionStrategyFactory;
      const factory = new AuthenticationMiddlewareFactory(
        bearerTokenParsingStrategyFactory,
        tokenIntrospectionStrategyFactory,
      );

      // when
      const middleware = factory.create(tokenType);

      // then
      expect(middleware).toEqual(expect.any(Function));
      expect(
        bearerTokenParsingStrategyFactory.create,
      ).toHaveBeenCalledExactlyOnceWith(tokenType);
      expect(
        tokenIntrospectionStrategyFactory.create,
      ).toHaveBeenCalledExactlyOnceWith(tokenType);
    },
  );
});
