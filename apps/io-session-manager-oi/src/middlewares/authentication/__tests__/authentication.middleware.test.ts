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
import type { TokenParsingStrategyFactory } from "../factories/token-parsing.factory.js";
import type { TokenTransportStrategyFactory } from "../factories/token-transport.factory.js";
import type { TokenIntrospectionStrategy } from "../strategies/token-introspection.strategy.js";
import type { TokenParsingStrategy } from "../strategies/token-parsing.strategy.js";
import type { TokenTransportStrategy } from "../strategies/token-transport.strategy.js";

describe("AuthenticationMiddleware", () => {
  const parsedToken: AuthToken["session"]["type"] = aPlainSessionToken;
  const extract = vi.fn();
  const parse = vi.fn();
  const resolve = vi.fn();
  const tokenTransportStrategy = {
    extract,
  } as unknown as TokenTransportStrategy;
  const tokenParsingStrategy = {
    parse,
  } as unknown as TokenParsingStrategy<"session">;
  const tokenIntrospectionStrategy = {
    resolve,
  } as unknown as TokenIntrospectionStrategy<"session">;
  const middleware = makeAuthenticationMiddleware(
    tokenTransportStrategy,
    tokenParsingStrategy,
    tokenIntrospectionStrategy,
  );

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns an AuthenticationError when the bearer token cannot be parsed", async () => {
    // given
    const authenticationError = new AuthenticationError();
    extract.mockReturnValueOnce(ok("Bearer token"));
    parse.mockReturnValueOnce(err(authenticationError));

    // when
    const result = await middleware({
      context: {},
      payload: { headers: { authorization: "Bearer token" } },
    });

    // then
    expect(result).toEqual(err(authenticationError));
    expect(extract).toHaveBeenCalledExactlyOnceWith({
      headers: { authorization: "Bearer token" },
    });
    expect(parse).toHaveBeenCalledExactlyOnceWith("Bearer token");
    expect(resolve).not.toHaveBeenCalled();
  });

  it("returns an AuthenticationError when session introspection fails", async () => {
    // given
    const authenticationError = new AuthenticationError();
    extract.mockReturnValueOnce(ok("Bearer token"));
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
    expect(extract).toHaveBeenCalledExactlyOnceWith({
      headers: { authorization: "Bearer token" },
    });
    expect(parse).toHaveBeenCalledExactlyOnceWith("Bearer token");
    expect(resolve).toHaveBeenCalledExactlyOnceWith(aSessionId, parsedToken);
  });

  it("returns the authenticated session and token context", async () => {
    // given
    extract.mockReturnValueOnce(ok("Bearer token"));
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
    expect(extract).toHaveBeenCalledExactlyOnceWith({
      headers: { authorization: "Bearer token" },
    });
    expect(parse).toHaveBeenCalledExactlyOnceWith("Bearer token");
    expect(resolve).toHaveBeenCalledExactlyOnceWith(aSessionId, parsedToken);
  });

  it("returns an AuthenticationError when the token cannot be extracted", async () => {
    // given
    const authenticationError = new AuthenticationError();
    extract.mockReturnValueOnce(err(authenticationError));

    // when
    const result = await middleware({ context: {}, payload: {} });

    // then
    expect(result).toEqual(err(authenticationError));
    expect(extract).toHaveBeenCalledExactlyOnceWith({});
    expect(parse).not.toHaveBeenCalled();
    expect(resolve).not.toHaveBeenCalled();
  });
});

describe("AuthenticationMiddlewareFactory", () => {
  it.each(["session", "bpd", "fims", "pagopa", "zendesk"] as const)(
    "creates middleware with strategies for %s tokens",
    (tokenType) => {
      // given
      const parsingStrategy = {} as TokenParsingStrategy<typeof tokenType>;
      const introspectionStrategy = {} as TokenIntrospectionStrategy<
        typeof tokenType
      >;
      const tokenTransportStrategyFactory = {
        create: vi.fn().mockReturnValue({}),
      } as unknown as TokenTransportStrategyFactory;
      const tokenParsingStrategyFactory = {
        create: vi.fn().mockReturnValue(parsingStrategy),
      } as unknown as TokenParsingStrategyFactory;
      const tokenIntrospectionStrategyFactory = {
        create: vi.fn().mockReturnValue(introspectionStrategy),
      } as unknown as TokenIntrospectionStrategyFactory;
      const factory = new AuthenticationMiddlewareFactory(
        tokenTransportStrategyFactory,
        tokenParsingStrategyFactory,
        tokenIntrospectionStrategyFactory,
      );

      // when
      const middleware = factory.create(tokenType);

      // then
      expect(middleware).toEqual(expect.any(Function));
      expect(
        tokenTransportStrategyFactory.create,
      ).toHaveBeenCalledExactlyOnceWith(tokenType);
      expect(
        tokenParsingStrategyFactory.create,
      ).toHaveBeenCalledExactlyOnceWith(tokenType);
      expect(
        tokenIntrospectionStrategyFactory.create,
      ).toHaveBeenCalledExactlyOnceWith(tokenType);
    },
  );
});
