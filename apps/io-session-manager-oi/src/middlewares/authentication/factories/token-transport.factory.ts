import { type TokenType } from "../auth-token.js";
import {
  AuthorizationHeaderTokenTransportStrategy,
  TokenTransportStrategy,
  UserTokenBodyTokenTransportStrategy,
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
        return new AuthorizationHeaderTokenTransportStrategy();
      case "bpd":
        return new AuthorizationHeaderTokenTransportStrategy();
      case "fims":
        return new AuthorizationHeaderTokenTransportStrategy();
      case "pagopa":
        return new AuthorizationHeaderTokenTransportStrategy();
      case "zendesk":
        return new UserTokenBodyTokenTransportStrategy();
      default:
        const _exhaustiveCheck: never = tokenType;
        console.error(`Unsupported token type: ${tokenType}`);
        throw new Error(`Unsupported token type: ${tokenType}`);
    }
  }
}
