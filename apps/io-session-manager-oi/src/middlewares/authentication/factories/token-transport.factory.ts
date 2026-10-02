import { type TokenType } from "../auth-token.js";
import {
  BearerAuthorizationHeaderTokenTransportStrategy,
  TokenTransportStrategy,
  ZendeskTokenTransportStrategy,
} from "../strategies/token-transport.strategy.js";

/**
 * Factory class for creating instances of TokenTransportStrategy.
 */
export class TokenTransportStrategyFactory {
  /**
   * Creates a new instance of TokenTransportStrategy for the specified token type.
   * @param tokenType The type of token for which to create the parsing strategy.
   * @returns An instance of TokenTransportStrategy for the specified token type.
   */
  create<T extends TokenType>(tokenType: T): TokenTransportStrategy {
    switch (tokenType) {
      case "session":
        return new BearerAuthorizationHeaderTokenTransportStrategy();
      case "bpd":
        return new BearerAuthorizationHeaderTokenTransportStrategy();
      case "fims":
        return new BearerAuthorizationHeaderTokenTransportStrategy();
      case "pagopa":
        return new BearerAuthorizationHeaderTokenTransportStrategy();
      case "zendesk":
        return new ZendeskTokenTransportStrategy();
      default:
        const _exhaustiveCheck: never = tokenType;
        console.error(`Unsupported token type: ${tokenType}`);
        throw new Error(`Unsupported token type: ${tokenType}`);
    }
  }
}
