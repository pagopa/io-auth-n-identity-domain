import { AuthenticationError, GenericError } from "@pagopa/hexagonal-core";
import { ExtendedPlainZendeskSSOTokenSchema } from "@pagopa/io-auth-n-identity-session";
import { err, ok } from "neverthrow";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockFindByBpdToken,
  mockFindBySessionToken,
  mockFindByZendeskToken,
  resetSessionPortMock,
  SessionPortMock,
} from "../../../../__mocks__/ports/session-port.mock.js";
import {
  aBaseSession,
  aGenericError,
  aNotFoundError,
  aPlainSessionToken,
  aSessionId,
  aSessionWithHashedTokens,
  aSessionWithPlainSSOTokens,
} from "../../../../__mocks__/session.mocks.js";
import type { AuthToken, TokenType } from "../../auth-token.js";
import {
  BpdTokenIntrospectionStrategy,
  SessionTokenIntrospectionStrategy,
  ZendeskTokenIntrospectionStrategy,
  type TokenIntrospectionStrategy,
} from "../token-introspection.strategy.js";

const mocks = vi.hoisted(() => ({
  toHashedSessionToken: vi.fn(),
  toHashedBpdSSOToken: vi.fn(),
  toHashedZendeskSSOToken: vi.fn(),
  toPlainZendeskSSOTokenFromExtended: vi.fn(),
}));

vi.mock("@pagopa/io-auth-n-identity-session", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@pagopa/io-auth-n-identity-session")>();
  return {
    ...actual,
    toHashedBpdSSOToken: mocks.toHashedBpdSSOToken,
    toHashedSessionToken: mocks.toHashedSessionToken,
    toHashedZendeskSSOToken: mocks.toHashedZendeskSSOToken,
    toPlainZendeskSSOTokenFromExtended:
      mocks.toPlainZendeskSSOTokenFromExtended,
  };
});

type StrategyTestCase<T extends TokenType> = {
  strategy: TokenIntrospectionStrategy<T>;
  sessionToken: AuthToken[T]["type"];
  findSession: ReturnType<typeof vi.fn>;
  expectedLookup: Record<string, unknown>;
};

const testTokenIntrospectionStrategy = <T extends TokenType>({
  strategy,
  sessionToken,
  findSession,
  expectedLookup,
}: StrategyTestCase<T>) => {
  beforeEach(() => {
    resetSessionPortMock();
    mocks.toHashedSessionToken
      .mockReset()
      .mockReturnValue(aSessionWithHashedTokens.hashedSessionToken);
    mocks.toHashedBpdSSOToken
      .mockReset()
      .mockReturnValue(aSessionWithHashedTokens.ssoTokens.bpdHashedToken);
    mocks.toHashedZendeskSSOToken
      .mockReset()
      .mockReturnValue(aSessionWithHashedTokens.ssoTokens.zendeskHashedToken);
    mocks.toPlainZendeskSSOTokenFromExtended
      .mockReset()
      .mockReturnValue(aSessionWithPlainSSOTokens.ssoTokens.zendeskPlainToken);
  });

  it("hashes the token, looks up the session, and returns it", async () => {
    // given
    findSession.mockResolvedValueOnce(ok(aBaseSession));

    // when
    const result = await strategy.resolve(aSessionId, sessionToken);

    // then
    expect(result).toEqual(ok(aBaseSession));
    expect(findSession).toHaveBeenCalledExactlyOnceWith(expectedLookup);
  });

  it("maps a not found error to AuthenticationError", async () => {
    // given
    findSession.mockResolvedValueOnce(err(aNotFoundError));

    // when
    const result = await strategy.resolve(aSessionId, sessionToken);

    // then
    expect(result).toEqual(err(new AuthenticationError()));
  });

  it("maps a generic error to GenericError", async () => {
    // given
    findSession.mockResolvedValueOnce(err(aGenericError));

    // when
    const result = await strategy.resolve(aSessionId, sessionToken);

    // then
    expect(result).toEqual(
      err(
        new GenericError("An unexpected error occurred during authentication."),
      ),
    );
  });
};

describe("SessionTokenIntrospectionStrategy", () => {
  testTokenIntrospectionStrategy({
    strategy: new SessionTokenIntrospectionStrategy(SessionPortMock),
    sessionToken: aPlainSessionToken,
    findSession: mockFindBySessionToken,
    expectedLookup: {
      sessionId: aSessionId,
      hashedSessionToken: aSessionWithHashedTokens.hashedSessionToken,
    },
  });
});

describe("BpdTokenIntrospectionStrategy", () => {
  testTokenIntrospectionStrategy({
    strategy: new BpdTokenIntrospectionStrategy(SessionPortMock),
    sessionToken: aSessionWithPlainSSOTokens.ssoTokens.bpdPlainToken,
    findSession: mockFindByBpdToken,
    expectedLookup: {
      sessionId: aSessionId,
      hashedBPDSSOToken: aSessionWithHashedTokens.ssoTokens.bpdHashedToken,
    },
  });
});

describe("ZendeskTokenIntrospectionStrategy", () => {
  const extendedToken = ExtendedPlainZendeskSSOTokenSchema.parse(
    `${aSessionWithPlainSSOTokens.ssoTokens.zendeskPlainToken}12345678`,
  );
  const strategy = new ZendeskTokenIntrospectionStrategy(SessionPortMock);

  testTokenIntrospectionStrategy({
    strategy,
    sessionToken: extendedToken,
    findSession: mockFindByZendeskToken,
    expectedLookup: {
      sessionId: aSessionId,
      hashedZendeskSSOToken:
        aSessionWithHashedTokens.ssoTokens.zendeskHashedToken,
    },
  });

  it("converts the extended token before hashing", async () => {
    mockFindByZendeskToken.mockResolvedValueOnce(ok(aBaseSession));

    await strategy.resolve(aSessionId, extendedToken);

    expect(
      mocks.toPlainZendeskSSOTokenFromExtended,
    ).toHaveBeenCalledExactlyOnceWith(extendedToken);
    expect(mocks.toHashedZendeskSSOToken).toHaveBeenCalledExactlyOnceWith(
      aSessionWithPlainSSOTokens.ssoTokens.zendeskPlainToken,
    );
  });
});
