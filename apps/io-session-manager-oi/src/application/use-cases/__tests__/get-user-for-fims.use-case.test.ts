import {
  AuthenticationError,
  GenericError,
  NotFoundError,
} from "@pagopa/hexagonal-core";
import { BaseSession } from "@pagopa/io-auth-n-identity-session/entities";
import { toPlainFimsSSOToken } from "@pagopa/io-auth-n-identity-session/value-objects";
import { err, ok } from "neverthrow";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  mockGetProfile,
  ProfilePortMock,
} from "../../../__mocks__/ports/profile-port.mock.js";

import {
  mockFindByFimsToken,
  resetSessionPortMock,
  SessionPortMock,
} from "../../../__mocks__/ports/session-port.mock.js";
import {
  aPlainSessionToken,
  aSessionWithHashedTokens,
  aUserProfileWithEmail,
  aUserProfileWithoutEmail,
  aUserProfileWithEmailNotValidated,
} from "../../../__mocks__/session.mocks.js";
import { makeGetUserForFimsUseCase } from "../get-user-for-fims.use-case.js";

const aPlainFimsSSOToken = toPlainFimsSSOToken(aPlainSessionToken);

const aBaseSession: BaseSession = aSessionWithHashedTokens;
const anExpectedHashedFimsSSOToken =
  aSessionWithHashedTokens.ssoTokens.fimsHashedToken;

const getUserForFims = makeGetUserForFimsUseCase({
  sessionPort: SessionPortMock,
  profilePort: ProfilePortMock,
});

beforeEach(() => {
  vi.clearAllMocks();
  resetSessionPortMock();
});

describe("makeGetUserForFimsUseCase", () => {
  it.each`
    emailStatus                   | profile                              | expectedEmail
    ${"with email validated"}     | ${aUserProfileWithEmail}             | ${aUserProfileWithEmail.email}
    ${"without email"}            | ${aUserProfileWithoutEmail}          | ${undefined}
    ${"with email not validated"} | ${aUserProfileWithEmailNotValidated} | ${undefined}
  `(
    "should return the Fims user and populate the email correctly for a profile $emailStatus",
    async ({ profile, expectedEmail }) => {
      mockFindByFimsToken.mockResolvedValueOnce(ok(aBaseSession));
      mockGetProfile.mockResolvedValueOnce(ok(profile));

      const result = await getUserForFims({
        sessionId: aBaseSession.sessionId,
        sessionToken: aPlainFimsSSOToken,
      });

      expect(mockFindByFimsToken).toHaveBeenCalledExactlyOnceWith({
        sessionId: aBaseSession.sessionId,
        hashedFimsSSOToken: anExpectedHashedFimsSSOToken,
      });
      expect(mockGetProfile).toHaveBeenCalledExactlyOnceWith(
        aBaseSession.fiscalCode,
      );

      // Read `createdAt` and convert it to a timestamp
      const expectedAuthTime = new Date(aBaseSession.createdAt).getTime();
      // Read `dateOfBirth` it to 'YYYY-MM-DD' format
      const expectedDateOfBirth = aBaseSession.dateOfBirth.toISOString().slice(0, 10);

      expect(result).toEqual(
        ok({
          name: aBaseSession.name,
          family_name: aBaseSession.familyName,
          fiscal_code: aBaseSession.fiscalCode,
          email: expectedEmail,
          acr: aBaseSession.spidLevel,
          auth_time: expectedAuthTime,
          date_of_birth: expectedDateOfBirth,
        }),
      );
    },
  );

  it("returns AuthenticationError when the session is not found", async () => {
    mockFindByFimsToken.mockResolvedValueOnce(
      err(new NotFoundError("FimsSSOSession", "not found")),
    );

    const result = await getUserForFims({
      sessionId: aBaseSession.sessionId,
      sessionToken: aPlainFimsSSOToken,
    });

    expect(result).toEqual(err(new AuthenticationError()));
  });

  it("propagates GenericError from the session port", async () => {
    const generic = new GenericError("cosmos exploded");
    mockFindByFimsToken.mockResolvedValueOnce(err(generic));

    const result = await getUserForFims({
      sessionId: aBaseSession.sessionId,
      sessionToken: aPlainFimsSSOToken,
    });

    expect(result).toEqual(err(generic));
  });
});
