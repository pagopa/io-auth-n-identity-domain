import { AuthenticationError, GenericError } from "@pagopa/hexagonal-core";
import { err, ok } from "neverthrow";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthToken, TokenType } from "../../auth-token.js";
import {
  BpdTokenIntrospectionStrategy,
  SessionTokenIntrospectionStrategy,
  type TokenIntrospectionStrategy,
} from "../token-introspection.strategy.js";

import {
  mockFindByBpdToken,
  mockFindBySessionToken,
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

const mocks = vi.hoisted(() => {
  return {
    toHashedSessionToken: vi.fn(),
    toHashedBpdSSOToken: vi.fn(),
  };
});

vi.mock("@pagopa/io-auth-n-identity-session", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@pagopa/io-auth-n-identity-session")>();
  return {
    ...actual,
    toHashedBpdSSOToken: mocks.toHashedBpdSSOToken,
    toHashedSessionToken: mocks.toHashedSessionToken,
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
