import {
  AuthenticationError,
  GenericError,
  NotFoundError,
} from "@pagopa/hexagonal-core";
import {
  type BaseSession,
  type SessionId,
  type SessionPort,
  toHashedBpdSSOToken,
  toHashedSessionToken,
} from "@pagopa/io-auth-n-identity-session";
import { err, ok, type Result } from "neverthrow";
import type { AuthToken, TokenType } from "../auth-token.js";

/**
 * Interface for token introspection strategies.
 * Implementations of this interface are responsible for resolving sessions based on the provided session ID and token.
 */
export interface TokenIntrospectionStrategy<T extends TokenType> {
  resolve(
    sessionId: SessionId,
    sessionToken: AuthToken[T]["type"],
  ): Promise<Result<BaseSession, AuthenticationError | GenericError>>;
}

/**
 * Abstract base class for token introspection strategies.
 * Provides common logic for resolving sessions based on the provided session ID and token (Template Method pattern).
 */
export abstract class TokenIntrospectionBaseStrategy<T extends TokenType>
  implements TokenIntrospectionStrategy<T>
{
  constructor(protected readonly sessionPort: SessionPort) {}

  async resolve(
    sessionId: SessionId,
    sessionToken: AuthToken[T]["type"],
  ): Promise<Result<BaseSession, AuthenticationError | GenericError>> {
    const hashedToken = this.toHashedToken(sessionToken);
    const maybeSession = await this.findSessionByToken(sessionId, hashedToken);
    if (maybeSession.isErr()) {
      switch (maybeSession.error.kind) {
        case "NotFoundError":
          // TODO: log the underlying error for debugging purposes
          console.warn(
            "Session not found during authentication:",
            maybeSession.error.message,
          );
          return err(new AuthenticationError());
        default:
          // TODO: log the underlying error for debugging purposes
          console.error(
            "Unexpected error during authentication:",
            maybeSession.error.message,
          );
          return err(
            new GenericError(
              "An unexpected error occurred during authentication.",
            ),
          );
      }
    }
    return ok(maybeSession.value);
  }

  /**
   * Finds a session by its token.
   * Must be implemented by subclasses to provide the specific logic for finding a session based on the token type.
   */
  protected abstract findSessionByToken(
    sessionId: SessionId,
    sessionToken: AuthToken[T]["hashedType"],
  ): Promise<Result<BaseSession, NotFoundError | GenericError>>;

  /**
   * Converts the provided session token to its hashed representation.
   * Must be implemented by subclasses to provide the specific logic for hashing the token based on its type.
   */
  protected abstract toHashedToken(
    sessionToken: AuthToken[T]["type"],
  ): AuthToken[T]["hashedType"];
}

/**
 * Token introspection strategy for session tokens.
 */
export class SessionTokenIntrospectionStrategy extends TokenIntrospectionBaseStrategy<"session"> {
  constructor(sessionPort: SessionPort) {
    super(sessionPort);
  }

  protected findSessionByToken(
    sessionId: SessionId,
    sessionToken: AuthToken["session"]["hashedType"],
  ): Promise<Result<BaseSession, NotFoundError | GenericError>> {
    return this.sessionPort.findBySessionToken({
      sessionId,
      hashedSessionToken: sessionToken,
    });
  }

  protected toHashedToken(
    sessionToken: AuthToken["session"]["type"],
  ): AuthToken["session"]["hashedType"] {
    return toHashedSessionToken(sessionToken);
  }
}

/**
 * Token introspection strategy for BPD tokens.
 */
export class BpdTokenIntrospectionStrategy extends TokenIntrospectionBaseStrategy<"bpd"> {
  constructor(sessionPort: SessionPort) {
    super(sessionPort);
  }

  protected findSessionByToken(
    sessionId: SessionId,
    sessionToken: AuthToken["bpd"]["hashedType"],
  ): Promise<Result<BaseSession, NotFoundError | GenericError>> {
    return this.sessionPort.findByBpdToken({
      sessionId,
      hashedBPDSSOToken: sessionToken,
    });
  }

  protected toHashedToken(
    sessionToken: AuthToken["bpd"]["type"],
  ): AuthToken["bpd"]["hashedType"] {
    return toHashedBpdSSOToken(sessionToken);
  }
}
