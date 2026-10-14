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

export type AuthenticationContext<T extends TokenType> = {
  session: BaseSession;
  sessionId: SessionId;
  sessionToken: AuthToken[T]["type"];
};

export type AuthenticationMiddleware<T extends TokenType> =
  HttpRequestMiddleware<
    EmptyHttpMiddlewareContext,
    AuthenticationContext<T>,
    AuthenticationError | GenericError
  >;

export type OptionalAuthenticationContext<Context extends object> =
  | { authenticated: false }
  | { authenticated: true; value: Context };

export type OptionalAuthenticationMiddleware<Context extends object> =
  HttpRequestMiddleware<
    EmptyHttpMiddlewareContext,
    OptionalAuthenticationContext<Context>,
    AuthenticationError | GenericError
  >;

type AuthenticationMiddlewareOptions = { optional: true };
type RequiredAuthenticationMiddlewareOptions = { optional?: false };

const makeRequiredAuthenticationMiddleware =
  <T extends TokenType>(
    tokenTransportStrategy: TokenTransportStrategy,
    tokenParsingStrategy: TokenParsingStrategy<T>,
    tokenIntrospectionStrategy: TokenIntrospectionStrategy<T>,
  ): AuthenticationMiddleware<T> =>
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

const wrapOptionalAuthentication =
  <Context extends object>(
    authenticate: HttpRequestMiddleware<
      EmptyHttpMiddlewareContext,
      Context,
      AuthenticationError | GenericError
    >,
  ): OptionalAuthenticationMiddleware<Context> =>
  async ({ payload }) => {
    const headers = payload.headers as
      | Record<string, string | undefined>
      | undefined;
    if (headers?.authorization === undefined) {
      return ok({ authenticated: false });
    }

    const result = await authenticate({ payload, context: {} });
    if (result.isErr()) {
      return err(result.error);
    }

    return ok({ authenticated: true, value: result.value });
  };

export function makeAuthenticationMiddleware<T extends TokenType>(
  tokenTransportStrategy: TokenTransportStrategy,
  tokenParsingStrategy: TokenParsingStrategy<T>,
  tokenIntrospectionStrategy: TokenIntrospectionStrategy<T>,
  options?: RequiredAuthenticationMiddlewareOptions,
): AuthenticationMiddleware<T>;
export function makeAuthenticationMiddleware<T extends TokenType>(
  tokenTransportStrategy: TokenTransportStrategy,
  tokenParsingStrategy: TokenParsingStrategy<T>,
  tokenIntrospectionStrategy: TokenIntrospectionStrategy<T>,
  options: AuthenticationMiddlewareOptions,
): OptionalAuthenticationMiddleware<AuthenticationContext<T>>;
export function makeAuthenticationMiddleware<T extends TokenType>(
  tokenTransportStrategy: TokenTransportStrategy,
  tokenParsingStrategy: TokenParsingStrategy<T>,
  tokenIntrospectionStrategy: TokenIntrospectionStrategy<T>,
  options?:
    | AuthenticationMiddlewareOptions
    | RequiredAuthenticationMiddlewareOptions,
):
  | AuthenticationMiddleware<T>
  | OptionalAuthenticationMiddleware<AuthenticationContext<T>> {
  const requiredMiddleware = makeRequiredAuthenticationMiddleware(
    tokenTransportStrategy,
    tokenParsingStrategy,
    tokenIntrospectionStrategy,
  );

  return options?.optional
    ? wrapOptionalAuthentication(requiredMiddleware)
    : requiredMiddleware;
}

/**
 * Factory class for creating authentication middleware instances based on the token type.
 */
export class AuthenticationMiddlewareFactory {
  constructor(
    private readonly tokenTransportStrategyFactory: TokenTransportStrategyFactory,
    private readonly tokenParsingStrategyFactory: TokenParsingStrategyFactory,
    private readonly tokenIntrospectionStrategyFactory: TokenIntrospectionStrategyFactory,
  ) {}

  create<T extends TokenType>(tokenType: T): AuthenticationMiddleware<T>;
  create<T extends TokenType>(
    tokenType: T,
    options: AuthenticationMiddlewareOptions,
  ): OptionalAuthenticationMiddleware<AuthenticationContext<T>>;
  create<T extends TokenType>(
    tokenType: T,
    options: RequiredAuthenticationMiddlewareOptions,
  ): AuthenticationMiddleware<T>;
  create<T extends TokenType>(
    tokenType: T,
    options?:
      | AuthenticationMiddlewareOptions
      | RequiredAuthenticationMiddlewareOptions,
  ):
    | AuthenticationMiddleware<T>
    | OptionalAuthenticationMiddleware<AuthenticationContext<T>> {
    const transportStrategy =
      this.tokenTransportStrategyFactory.create<T>(tokenType);
    const parsingStrategy =
      this.tokenParsingStrategyFactory.create<T>(tokenType);
    const introspectionStrategy =
      this.tokenIntrospectionStrategyFactory.create<T>(tokenType);

    if (options?.optional) {
      return makeAuthenticationMiddleware(
        transportStrategy,
        parsingStrategy,
        introspectionStrategy,
        { optional: true },
      );
    }
    return makeAuthenticationMiddleware(
      transportStrategy,
      parsingStrategy,
      introspectionStrategy,
      options,
    );
  }
}
