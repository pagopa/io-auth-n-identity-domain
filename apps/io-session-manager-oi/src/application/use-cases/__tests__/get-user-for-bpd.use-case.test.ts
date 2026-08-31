import {
  AuthenticationError,
  GenericError,
  NotFoundError,
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
const aValidAuthorizationHeader = `Bearer ${aBpdClientSessionToken}`;
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
      authorizationHeader: aValidAuthorizationHeader,
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
    scenario                      | authorizationHeader
    ${"missing header"}           | ${undefined}
    ${"empty header"}             | ${""}
    ${"non-Bearer scheme"}        | ${`Basic ${aBpdClientSessionToken}`}
    ${"lowercase bearer prefix"}  | ${`bearer ${aBpdClientSessionToken}`}
    ${"Bearer with empty token"}  | ${"Bearer "}
    ${"no separator in token"}    | ${`Bearer ${aSessionId}${aPlainBpdSSOToken}`}
    ${"empty sessionId in token"} | ${`Bearer .${aPlainBpdSSOToken}`}
    ${"non-hex plainBpdSSOToken"} | ${`Bearer ${aSessionId}.not-a-sha256-hex`}
  `(
    "returns AuthenticationError when the Bearer credentials are invalid ($scenario)",
    async ({ authorizationHeader }) => {
      const result = await getUserForBpd({ authorizationHeader });

      expect(result).toEqual(err(new AuthenticationError()));
      expect(mockFindByBpdToken).not.toHaveBeenCalled();
    },
  );

  it("returns AuthenticationError when the session is not found (Express passport-bearer parity)", async () => {
    mockFindByBpdToken.mockResolvedValueOnce(
      err(new NotFoundError("BPDSSOSession", "not found")),
    );

    const result = await getUserForBpd({
      authorizationHeader: aValidAuthorizationHeader,
    });

    expect(result).toEqual(err(new AuthenticationError()));
  });

  it("propagates GenericError from the session port", async () => {
    const generic = new GenericError("cosmos exploded");
    mockFindByBpdToken.mockResolvedValueOnce(err(generic));

    const result = await getUserForBpd({
      authorizationHeader: aValidAuthorizationHeader,
    });

    expect(result).toEqual(err(generic));
  });
});
