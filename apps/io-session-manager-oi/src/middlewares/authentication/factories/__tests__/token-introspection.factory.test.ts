import { describe, expect, it } from "vitest";

import { SessionPortMock } from "../../../../__mocks__/ports/session-port.mock.js";
import {
  BpdTokenIntrospectionStrategy,
  SessionTokenIntrospectionStrategy,
} from "../../strategies/token-introspection.strategy.js";
import { TokenIntrospectionStrategyFactory } from "../token-introspection.factory.js";

describe("TokenIntrospectionStrategyFactory", () => {
  const factory = new TokenIntrospectionStrategyFactory(SessionPortMock);

  it("creates a session token strategy", () => {
    // given

    // when
    const strategy = factory.create("session");

    // then
    expect(strategy).toBeInstanceOf(SessionTokenIntrospectionStrategy);
  });

  it("creates a BPD token strategy", () => {
    // given

    // when
    const strategy = factory.create("bpd");

    // then
    expect(strategy).toBeInstanceOf(BpdTokenIntrospectionStrategy);
  });
});
