import type { SessionPort } from "@pagopa/io-auth-n-identity-session";

import type { TokenType } from "../auth-token.js";
import {
  BpdTokenIntrospectionStrategy,
  SessionTokenIntrospectionStrategy,
  type TokenIntrospectionStrategy,
  FimsTokenIntrospectionStrategy,
} from "../strategies/token-introspection.strategy.js";

/**
 * Factory class for creating token introspection strategies based on the token type.
 */
export class TokenIntrospectionStrategyFactory {
  constructor(private readonly sessionPort: SessionPort) {}

  create<T extends TokenType>(tokenType: T): TokenIntrospectionStrategy<T> {
    switch (tokenType) {
      case "session":
        return new SessionTokenIntrospectionStrategy(this.sessionPort);
      case "bpd":
        return new BpdTokenIntrospectionStrategy(this.sessionPort);
      case "fims":
        return new FimsTokenIntrospectionStrategy(this.sessionPort);
      default:
        const _exhaustiveCheck: never = tokenType;
        throw new Error(`Unsupported token type: ${tokenType}`);
    }
  }
}
