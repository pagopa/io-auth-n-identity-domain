import type {
  AuthenticationError,
  EmptyHttpMiddlewareContext,
  GenericError,
  HttpRequestMiddleware,
  NonEmptyString,
} from "@pagopa/hexagonal-core";
import type {
  BaseSession,
  SessionId,
} from "@pagopa/io-auth-n-identity-session";
import type { Result } from "neverthrow";
import { err, ok } from "neverthrow";

import type { AuthToken, TokenType } from "./auth-token.js";
import type { TokenIntrospectionStrategyFactory } from "./factories/token-introspection.factory.js";
import type { TokenParsingStrategyFactory } from "./factories/token-parsing.factory.js";
import { TokenTransportStrategyFactory } from "./factories/token-transport.factory.js";
import type { TokenIntrospectionStrategy } from "./strategies/token-introspection.strategy.js";
import type { TokenParsingStrategy } from "./strategies/token-parsing.strategy.js";
import type { TokenTransportStrategy } from "./strategies/token-transport.strategy.js";

export type AuthenticationMiddleware<T extends TokenType> =
  HttpRequestMiddleware<
    EmptyHttpMiddlewareContext,
    {
      session: BaseSession;
      sessionId: SessionId;
      sessionToken: AuthToken[T]["type"];
    },
    AuthenticationError | GenericError
  >;

type MakeAuthenticationMiddleware = <T extends TokenType>(
  tokenTransportStrategy: TokenTransportStrategy,
  tokenParsingStrategy: TokenParsingStrategy<T>,
  tokenIntrospectionStrategy: TokenIntrospectionStrategy<T>,
) => AuthenticationMiddleware<T>;

export const makeAuthenticationMiddleware: MakeAuthenticationMiddleware =
  (tokenTransportStrategy, tokenParsingStrategy, tokenIntrospectionStrategy) =>
  async ({ payload }) => {
    // Extract the raw token from the request payload using the transport strategy
    const rawToken: Result<NonEmptyString, AuthenticationError> =
      tokenTransportStrategy.extract(payload);
    if (rawToken.isErr()) {
      return err(rawToken.error);
    }

    // Parse the raw token using the parsing strategy
    const parsedToken = tokenParsingStrategy.parse(rawToken.value);
    if (parsedToken.isErr()) {
      return err(parsedToken.error);
    }
    const { sessionId, sessionToken } = parsedToken.value;

    // Introspect the session using the introspection strategy
    const maybeSession = await tokenIntrospectionStrategy.resolve(
      sessionId,
      sessionToken,
    );
    if (maybeSession.isErr()) {
      return err(maybeSession.error);
    }

    // Return the authenticated session along with the session ID and token
    return ok({
      session: maybeSession.value,
      sessionId,
      sessionToken,
    });
  };

/**
 * Factory class for creating authentication middleware instances based on the token type.
 */
export class AuthenticationMiddlewareFactory {
  constructor(
    private readonly tokenTransportStrategyFactory: TokenTransportStrategyFactory,
    private readonly tokenParsingStrategyFactory: TokenParsingStrategyFactory,
    private readonly tokenIntrospectionStrategyFactory: TokenIntrospectionStrategyFactory,
  ) {}

  create<T extends TokenType>(tokenType: T): AuthenticationMiddleware<T> {
    return makeAuthenticationMiddleware(
      this.tokenTransportStrategyFactory.create<T>(tokenType),
      this.tokenParsingStrategyFactory.create<T>(tokenType),
      this.tokenIntrospectionStrategyFactory.create<T>(tokenType),
    );
  }
}
