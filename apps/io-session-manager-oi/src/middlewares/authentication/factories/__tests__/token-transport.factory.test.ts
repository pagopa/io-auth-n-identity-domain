import { describe, expect, it } from "vitest";

import {
  BearerAuthorizationHeaderTokenTransportStrategy,
  ZendeskTokenTransportStrategy,
} from "../../strategies/token-transport.strategy.js";
import { TokenTransportStrategyFactory } from "../token-transport.factory.js";

describe("TokenTransportStrategyFactory", () => {
  const factory = new TokenTransportStrategyFactory();

  it.each(["session", "bpd", "fims", "pagopa"] as const)(
    "creates an authorization-header strategy for %s tokens",
    (tokenType) => {
      expect(factory.create(tokenType)).toBeInstanceOf(
        BearerAuthorizationHeaderTokenTransportStrategy,
      );
    },
  );

  it("creates a body strategy for Zendesk tokens", () => {
    expect(factory.create("zendesk")).toBeInstanceOf(
      ZendeskTokenTransportStrategy,
    );
  });
});
