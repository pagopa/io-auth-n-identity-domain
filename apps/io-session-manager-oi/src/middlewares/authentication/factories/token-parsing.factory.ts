import { type TokenType } from "../auth-token.js";
import {
  BpdBearerTokenParsingStrategy,
  SessionBearerTokenParsingStrategy,
  FimsBearerTokenParsingStrategy,
  PagopaBearerTokenParsingStrategy,
  ZendeskTokenParsingStrategy,
} from "../strategies/token-parsing.strategy.js";
import type { TokenParsingStrategy } from "../strategies/token-parsing.strategy.js";

/**
 * Factory class for creating instances of BearerTokenParsingStrategy.
 */
export class TokenParsingStrategyFactory {
  /**
   * Creates a new instance of BearerTokenParsingStrategy for the specified token type.
   * @param tokenType The type of token for which to create the parsing strategy.
   * @returns An instance of BearerTokenParsingStrategy for the specified token type.
   */
  create<T extends TokenType>(tokenType: T): TokenParsingStrategy<T> {
    switch (tokenType) {
      case "session":
        return new SessionBearerTokenParsingStrategy();
      case "bpd":
        return new BpdBearerTokenParsingStrategy();
      case "fims":
        return new FimsBearerTokenParsingStrategy();
      case "pagopa":
        return new PagopaBearerTokenParsingStrategy();
      case "zendesk":
        return new ZendeskTokenParsingStrategy();
      default:
        const _exhaustiveCheck: never = tokenType;
        console.error(`Unsupported token type: ${tokenType}`);
        throw new Error(`Unsupported token type: ${tokenType}`);
    }
  }
}
