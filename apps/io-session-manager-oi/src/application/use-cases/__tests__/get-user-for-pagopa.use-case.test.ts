import { GenericError, ValidationError } from "@pagopa/hexagonal-core";
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
} from "../../../__mocks__/session.mocks.js";
import { makeGetUserForPagopaUseCase } from "../get-user-for-pagopa.use-case.js";

const getUserForPagopa = makeGetUserForPagopaUseCase({
  profilePort: ProfilePortMock,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("makeGetUserForPagopaUseCase", () => {
  it("returns the PagoPA user when the profile email is validated", async () => {
    mockGetProfile.mockResolvedValueOnce(ok(aUserProfileWithEmail));

    const result = await getUserForPagopa({
      session: aSessionWithHashedTokens,
    });

    expect(result).toEqual(
      ok({
        name: aSessionWithHashedTokens.name,
        family_name: aSessionWithHashedTokens.familyName,
        fiscal_code: aSessionWithHashedTokens.fiscalCode,
        spid_email: aSessionWithHashedTokens.spidEmail,
        notice_email: aUserProfileWithEmail.email,
      }),
    );
  });

  it("returns ValidationError when the profile email is not validated", async () => {
    mockGetProfile.mockResolvedValueOnce(ok(aUserProfileWithoutEmail));

    const result = await getUserForPagopa({
      session: aSessionWithHashedTokens,
    });

    expect(result).toEqual(
      err(new ValidationError("Notice email is not validated")),
    );
  });

  it("propagates errors from the profile port", async () => {
    const error = new GenericError("cosmos exploded");
    mockGetProfile.mockResolvedValueOnce(err(error));

    const result = await getUserForPagopa({
      session: aSessionWithHashedTokens,
    });

    expect(result).toEqual(err(error));
  });
});
