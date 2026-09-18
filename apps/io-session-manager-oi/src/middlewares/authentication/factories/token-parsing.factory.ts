import { type TokenType } from "../auth-token.js";
import {
  BpdBearerTokenParsingStrategy,
  SessionBearerTokenParsingStrategy,
  FimsBearerTokenParsingStrategy,
  WalletBearerTokenParsingStrategy,
} from "../strategies/token-parsing.strategy.js";

/**
 * Factory class for creating instances of BearerTokenParsingStrategy.
 */
export class BearerTokenParsingStrategyFactory {
  /**
   * Creates a new instance of BearerTokenParsingStrategy for the specified token type.
   * @param tokenType The type of token for which to create the parsing strategy.
   * @returns An instance of BearerTokenParsingStrategy for the specified token type.
   */
  create<T extends TokenType>(tokenType: T) {
    switch (tokenType) {
      case "session":
        return new SessionBearerTokenParsingStrategy();
      case "bpd":
        return new BpdBearerTokenParsingStrategy();
      case "fims":
        return new FimsBearerTokenParsingStrategy();
      case "wallet":
        return new WalletBearerTokenParsingStrategy();
      default:
        const _exhaustiveCheck: never = tokenType;
        console.error(`Unsupported token type: ${tokenType}`);
        throw new Error(`Unsupported token type: ${tokenType}`);
    }
  }
}
