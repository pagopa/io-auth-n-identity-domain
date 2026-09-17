import { describe, expect, it } from "vitest";

import {
  BpdBearerTokenParsingStrategy,
  SessionBearerTokenParsingStrategy,
} from "../../strategies/token-parsing.strategy.js";
import { BearerTokenParsingStrategyFactory } from "../token-parsing.factory.js";

describe("BearerTokenParsingStrategyFactory", () => {
  const factory = new BearerTokenParsingStrategyFactory();

  it("creates a strategy for session tokens", () => {
    // given

    // when
    const strategy = factory.create("session");

    // then
    expect(strategy).toBeInstanceOf(SessionBearerTokenParsingStrategy);
  });

  it("creates a strategy for BPD tokens", () => {
    // given

    // when
    const strategy = factory.create("bpd");

    // then
    expect(strategy).toBeInstanceOf(BpdBearerTokenParsingStrategy);
  });

  it("creates a new strategy for each request", () => {
    // given

    // when
    const firstStrategy = factory.create("session");
    const secondStrategy = factory.create("session");

    // then
    expect(firstStrategy).not.toBe(secondStrategy);
  });
});
