import { AuthenticationError } from "@pagopa/hexagonal-core";
import { ExtendedPlainZendeskSSOTokenSchema } from "@pagopa/io-auth-n-identity-session";
import { err, ok } from "neverthrow";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  aClientSessionToken,
  aPlainSessionToken,
  aSessionId,
  aSessionWithPlainSSOTokens,
} from "../../../../__mocks__/session.mocks.js";
import type { AuthToken, TokenType } from "../../auth-token.js";
import {
  BpdBearerTokenParsingStrategy,
  SessionBearerTokenParsingStrategy,
  ZendeskBodyTokenParsingStrategy,
  type BearerTokenParsingStrategy,
} from "../token-parsing.strategy.js";

type ParsingStrategyTestCase<T extends TokenType> = {
  strategy: BearerTokenParsingStrategy<T>;
  validBearerToken: string;
  expectedToken: AuthToken[T]["type"];
};

const testBearerTokenParsingStrategy = <T extends TokenType>({
  strategy,
  validBearerToken,
  expectedToken,
}: ParsingStrategyTestCase<T>) => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  it("parses a valid Bearer token", () => {
    // given

    // when
    const result = strategy.parse(validBearerToken);

    // then
    expect(result).toEqual(
      ok({
        sessionId: aSessionId,
        sessionToken: expectedToken,
      }),
    );
  });

  it.each([
    undefined,
    "",
    "Basic aSessionId.aSessionToken",
    "bearer aSessionId.aSessionToken",
    "Bearer",
    "Bearer ",
    "Bearer aSessionId",
    "Bearer .aSessionToken",
    "Bearer aSessionId.",
    "Bearer aSessionId.aSessionToken.extra",
  ])("returns AuthenticationError for invalid token: %o", (token) => {
    // given

    // when
    const result = strategy.parse(token as string);

    // then
    expect(result).toEqual(err(new AuthenticationError()));
  });
};

describe("SessionBearerTokenParsingStrategy", () => {
  testBearerTokenParsingStrategy({
    strategy: new SessionBearerTokenParsingStrategy(),
    validBearerToken: `Bearer ${aClientSessionToken}`,
    expectedToken: aPlainSessionToken,
  });
});

describe("BpdBearerTokenParsingStrategy", () => {
  testBearerTokenParsingStrategy({
    strategy: new BpdBearerTokenParsingStrategy(),
    validBearerToken: `Bearer ${aSessionId}.${aSessionWithPlainSSOTokens.ssoTokens.bpdPlainToken}`,
    expectedToken: aSessionWithPlainSSOTokens.ssoTokens.bpdPlainToken,
  });
});

describe("ZendeskBodyTokenParsingStrategy", () => {
  const strategy = new ZendeskBodyTokenParsingStrategy();
  const extendedToken = ExtendedPlainZendeskSSOTokenSchema.parse(
    `${aSessionWithPlainSSOTokens.ssoTokens.zendeskPlainToken}12345678`,
  );

  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  it("parses a session ID and extended Zendesk token", () => {
    expect(strategy.parse(`${aSessionId}.${extendedToken}`)).toEqual(
      ok({ sessionId: aSessionId, sessionToken: extendedToken }),
    );
  });

  it.each([
    "",
    "sessionId",
    `${aSessionId}.`,
    `${aSessionId}.${"a".repeat(64)}`,
  ])("returns AuthenticationError for invalid token: %o", (token) => {
    expect(strategy.parse(token)).toEqual(err(new AuthenticationError()));
  });
});
