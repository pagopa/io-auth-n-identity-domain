import type {
  AuthenticationError,
  EmptyHttpMiddlewareContext,
  GenericError,
  HttpRequestMiddleware,
} from "@pagopa/hexagonal-core";
import type {
  BaseSession,
  SessionId,
} from "@pagopa/io-auth-n-identity-session";
import { err, ok } from "neverthrow";

import type { AuthToken, TokenType } from "./auth-token.js";
import type { TokenIntrospectionStrategyFactory } from "./factories/token-introspection.factory.js";
import type { BearerTokenParsingStrategyFactory } from "./factories/token-parsing.factory.js";
import type { TokenIntrospectionStrategy } from "./strategies/token-introspection.strategy.js";
import type { BearerTokenParsingStrategy } from "./strategies/token-parsing.strategy.js";

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
  bearerTokenParsingStrategy: BearerTokenParsingStrategy<T>,
  tokenIntrospectionStrategy: TokenIntrospectionStrategy<T>,
) => AuthenticationMiddleware<T>;

export const makeAuthenticationMiddleware: MakeAuthenticationMiddleware = (
  bearerTokenParsingStrategy,
  tokenIntrospectionStrategy,
) => async ({ payload }) => {
    const headers = payload.headers as { authorization?: string } | undefined;
    const parsedBearerToken = bearerTokenParsingStrategy.parse(
      headers?.authorization ?? "",
    );
    if (parsedBearerToken.isErr()) {
      return err(parsedBearerToken.error);
    }
    const { sessionId, sessionToken } = parsedBearerToken.value;

    const maybeSession = await tokenIntrospectionStrategy.resolve(
      parsedBearerToken.value.sessionId,
      parsedBearerToken.value.sessionToken,
    );
    if (maybeSession.isErr()) {
      return err(maybeSession.error);
    }

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
    private readonly bearerTokenParsingStrategyFactory: BearerTokenParsingStrategyFactory,
    private readonly tokenIntrospectionStrategyFactory: TokenIntrospectionStrategyFactory,
  ) {}

  create<T extends TokenType>(tokenType: T): AuthenticationMiddleware<T> {
    return makeAuthenticationMiddleware(
      this.bearerTokenParsingStrategyFactory.create<T>(tokenType),
      this.tokenIntrospectionStrategyFactory.create<T>(tokenType),
    );
  }
}
