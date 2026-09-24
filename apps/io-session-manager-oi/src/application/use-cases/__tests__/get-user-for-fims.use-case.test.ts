import { GenericError, NotFoundError } from "@pagopa/hexagonal-core";
import { BaseSession } from "@pagopa/io-auth-n-identity-session/entities";
import { err, ok } from "neverthrow";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  mockGetProfile,
  ProfilePortMock,
} from "../../../__mocks__/ports/profile-port.mock.js";

import {
  aSessionWithHashedTokens,
  aUserProfileWithEmail,
  aUserProfileWithoutEmail,
  aUserProfileWithEmailNotValidated,
} from "../../../__mocks__/session.mocks.js";
import { makeGetUserForFimsUseCase } from "../get-user-for-fims.use-case.js";

const aBaseSession: BaseSession = aSessionWithHashedTokens;

const getUserForFims = makeGetUserForFimsUseCase({
  profilePort: ProfilePortMock,
});

beforeEach(() => {
  vi.clearAllMocks();
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
      mockGetProfile.mockResolvedValueOnce(ok(profile));

      const result = await getUserForFims({
        session: aBaseSession,
      });

      expect(mockGetProfile).toHaveBeenCalledExactlyOnceWith(
        aBaseSession.fiscalCode,
      );

      // Read `createdAt` and convert it to a timestamp
      const expectedAuthTime = new Date(aBaseSession.createdAt).getTime();
      // Read `dateOfBirth` it to 'YYYY-MM-DD' format
      const expectedDateOfBirth = aBaseSession.dateOfBirth
        .toISOString()
        .slice(0, 10);

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

  it("propagates NotFoundError when the profile is not found", async () => {
    const notFound = new NotFoundError("Profile", "not found");
    mockGetProfile.mockResolvedValueOnce(err(notFound));

    const result = await getUserForFims({
      session: aBaseSession,
    });

    expect(result).toEqual(err(notFound));
  });

  it("propagates GenericError from the profile port", async () => {
    const generic = new GenericError("cosmos exploded");
    mockGetProfile.mockResolvedValueOnce(err(generic));

    const result = await getUserForFims({
      session: aBaseSession,
    });

    expect(result).toEqual(err(generic));
  });
});
