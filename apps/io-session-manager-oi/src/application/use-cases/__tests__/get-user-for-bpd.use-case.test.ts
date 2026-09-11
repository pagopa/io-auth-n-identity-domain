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

const aBaseSession: BaseSession = aSessionWithHashedTokens;
const anExpectedHashedBpdSSOToken =
  aSessionWithHashedTokens.ssoTokens.bpdHashedToken;

const getUserForBpd = makeGetUserForBpdUseCase({
  sessionPort: SessionPortMock,
});

beforeEach(() => {
  vi.clearAllMocks();
  resetSessionPortMock();
});

describe("makeGetUserForBpdUseCase", () => {
  it("returns the BPD user and looks up the session by (sessionId, hashedBPDSSOToken)", async () => {
    mockFindByBpdToken.mockResolvedValueOnce(ok(aBaseSession));

    const result = await getUserForBpd({
      sessionId: aSessionId,
      sessionToken: aPlainBpdSSOToken,
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

  it("returns AuthenticationError when the session is not found", async () => {
    mockFindByBpdToken.mockResolvedValueOnce(
      err(new NotFoundError("BPDSSOSession", "not found")),
    );

    const result = await getUserForBpd({
      sessionId: aSessionId,
      sessionToken: aPlainBpdSSOToken,
    });

    expect(result).toEqual(err(new AuthenticationError()));
  });

  it("propagates GenericError from the session port", async () => {
    const generic = new GenericError("cosmos exploded");
    mockFindByBpdToken.mockResolvedValueOnce(err(generic));

    const result = await getUserForBpd({
      sessionId: aSessionId,
      sessionToken: aPlainBpdSSOToken,
    });

    expect(result).toEqual(err(generic));
  });
});
