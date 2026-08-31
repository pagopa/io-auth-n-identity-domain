import {
  GenericError,
  NotFoundError,
  ValidationError,
} from "@pagopa/hexagonal-core";
import { BaseSession } from "@pagopa/io-auth-n-identity-session/entities";
import { toPlainBpdSSOToken } from "@pagopa/io-auth-n-identity-session/value-objects";
import { err, ok } from "neverthrow";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockFindByBpdToken,
  resetSessionPortMock,
  SessionPortMock,
} from "../../../__mocks__/ports/session-port.mock.js";
import {
  aFamilyName,
  aFiscalCode,
  aName,
  aPlainSessionToken,
  aSessionId,
  aSessionWithHashedTokens,
} from "../../../__mocks__/session.mocks.js";
import { makeGetUserForBpdUseCase } from "../get-user-for-bpd.use-case.js";

const aPlainBpdSSOToken = toPlainBpdSSOToken(aPlainSessionToken);
const aBpdClientSessionToken = `${aSessionId}.${aPlainBpdSSOToken}`;
const aBaseSession: BaseSession = aSessionWithHashedTokens;
const anExpectedHashedBpdSSOToken =
  aSessionWithHashedTokens.ssoTokens.bpdHashedToken;

const getUserForBpd = makeGetUserForBpdUseCase(SessionPortMock);

beforeEach(() => {
  vi.clearAllMocks();
  resetSessionPortMock();
});

describe("makeGetUserForBpdUseCase", () => {
  it("returns the BPD user and looks up the session by (sessionId, hashedBPDSSOToken)", async () => {
    mockFindByBpdToken.mockResolvedValueOnce(ok(aBaseSession));

    const result = await getUserForBpd({
      bpdClientSessionToken: aBpdClientSessionToken,
    });

    expect(result).toEqual(
      ok({
        name: aName,
        family_name: aFamilyName,
        fiscal_code: aFiscalCode,
      }),
    );
    expect(mockFindByBpdToken).toHaveBeenCalledExactlyOnceWith({
      sessionId: aSessionId,
      hashedBPDSSOToken: anExpectedHashedBpdSSOToken,
    });
  });

  it.each`
    scenario                      | bpdClientSessionToken
    ${"no separator in token"}    | ${`${aSessionId}${aPlainBpdSSOToken}`}
    ${"empty sessionId"}          | ${`.${aPlainBpdSSOToken}`}
    ${"non-hex plainBpdSSOToken"} | ${`${aSessionId}.not-a-sha256-hex`}
    ${"empty string"}             | ${""}
  `(
    "returns ValidationError when the token is invalid ($scenario)",
    async ({ bpdClientSessionToken }) => {
      const result = await getUserForBpd({ bpdClientSessionToken });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toBeInstanceOf(ValidationError);
      }
      expect(mockFindByBpdToken).not.toHaveBeenCalled();
    },
  );

  it("propagates NotFoundError from the session port", async () => {
    const notFound = new NotFoundError("BPDSSOSession", "not found");
    mockFindByBpdToken.mockResolvedValueOnce(err(notFound));

    const result = await getUserForBpd({
      bpdClientSessionToken: aBpdClientSessionToken,
    });

    expect(result).toEqual(err(notFound));
  });

  it("propagates GenericError from the session port", async () => {
    const generic = new GenericError("cosmos exploded");
    mockFindByBpdToken.mockResolvedValueOnce(err(generic));

    const result = await getUserForBpd({
      bpdClientSessionToken: aBpdClientSessionToken,
    });

    expect(result).toEqual(err(generic));
  });
});
