import { GenericError } from "@pagopa/hexagonal-core";
import { err, ok } from "neverthrow";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { lollipopActivationPortMock } from "../../../__mocks__/ports/lollipop-activation-port.mock.js";
import {
  mockGetProfile,
  ProfilePortMock,
  resetProfilePortMock,
} from "../../../__mocks__/ports/profile-port.mock.js";
import {
  mockFindBySessionToken,
  SessionPortMock,
} from "../../../__mocks__/ports/session-port.mock.js";
import {
  aFiscalCode,
  aGenericError,
  anEmailAddress,
  aNotFoundError,
  aPlainSessionToken,
  aSessionId,
  aSessionWithHashedTokens,
  aUserProfileWithoutEmail,
} from "../../../__mocks__/session.mocks.js";
import {
  type GetSessionInput,
  makeGetSessionUseCase,
} from "../get-session.use-case.js";

const mocks = vi.hoisted(() => {
  const anExtendedZendeskToken = "aExtendedZendeskToken";
  const anHashedSessionToken = "anHashedSessionToken";
  const aPlainBpdSSOToken = "aPlainBpdSSOToken";
  const aFimsSSOToken = "aFimsSSOToken";
  const aWalletSSOToken = "aWalletSSOToken";
  return {
    anExtendedZendeskToken,
    anHashedSessionToken,
    aPlainBpdSSOToken,
    aFimsSSOToken,
    aWalletSSOToken,
    toExtendedPlainZendeskSSOToken: vi.fn(() => anExtendedZendeskToken),
    toHashedSessionToken: vi.fn(() => anHashedSessionToken),
    toPlainBpdSSOToken: vi.fn(() => aPlainBpdSSOToken),
    toPlainFimsSSOToken: vi.fn(() => aFimsSSOToken),
    toPlainWalletSSOToken: vi.fn(() => aWalletSSOToken),
  };
});

vi.mock("@pagopa/io-auth-n-identity-session", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@pagopa/io-auth-n-identity-session")>();
  return {
    ...actual,
    toExtendedPlainZendeskSSOToken: mocks.toExtendedPlainZendeskSSOToken,
    toHashedSessionToken: mocks.toHashedSessionToken,
    toPlainBpdSSOToken: mocks.toPlainBpdSSOToken,
    toPlainFimsSSOToken: mocks.toPlainFimsSSOToken,
    toPlainWalletSSOToken: mocks.toPlainWalletSSOToken,
  };
});

beforeEach(() => {
  vi.resetAllMocks();
  resetProfilePortMock();
  mockFindBySessionToken.mockResolvedValue(ok(aSessionWithHashedTokens));
});

describe("makeGetSessionUseCase", () => {
  const lollipopActivation = {
    fiscalCode: aFiscalCode,
    assertionRef: "sha256-assertion-ref",
    expirationDate: new Date("2100-01-01"),
  };

  const getSession = makeGetSessionUseCase({
    sessionPort: SessionPortMock,
    lollipopActivationPort: lollipopActivationPortMock,
    profilePort: ProfilePortMock,
  });

  const commonExpectations = () => {
    expect(mocks.toPlainWalletSSOToken).not.toHaveBeenCalled();
    expect(mocks.toPlainBpdSSOToken).not.toHaveBeenCalled();
    expect(mocks.toPlainFimsSSOToken).not.toHaveBeenCalled();
    expect(mocks.toExtendedPlainZendeskSSOToken).not.toHaveBeenCalled();
    expect(lollipopActivationPortMock.getByFiscalCode).not.toHaveBeenCalled();
    expect(mockGetProfile).not.toHaveBeenCalled();
  };
  const sessionFields = [
    {
      field: "spidLevel",
      expectedValue: aSessionWithHashedTokens.spidLevel,
      checkExpectations: commonExpectations,
    },
    {
      field: "expirationDate",
      expectedValue: aSessionWithHashedTokens.expirationDate,
      checkExpectations: commonExpectations,
    },
    {
      field: "lollipopAssertionRef",
      expectedValue: lollipopActivation.assertionRef,
      checkExpectations: () => {
        expect(
          lollipopActivationPortMock.getByFiscalCode,
        ).toHaveBeenCalledExactlyOnceWith(aFiscalCode);
        expect(mockGetProfile).not.toHaveBeenCalled();
        expect(mocks.toPlainWalletSSOToken).not.toHaveBeenCalled();
        expect(mocks.toPlainBpdSSOToken).not.toHaveBeenCalled();
        expect(mocks.toPlainFimsSSOToken).not.toHaveBeenCalled();
        expect(mocks.toExtendedPlainZendeskSSOToken).not.toHaveBeenCalled();
      },
    },
    {
      field: "walletToken",
      expectedValue: mocks.aWalletSSOToken,
      checkExpectations: () => {
        expect(mocks.toPlainWalletSSOToken).toHaveBeenCalledExactlyOnceWith(
          aPlainSessionToken,
        );
        expect(mocks.toPlainBpdSSOToken).not.toHaveBeenCalled();
        expect(mocks.toPlainFimsSSOToken).not.toHaveBeenCalled();
        expect(mocks.toExtendedPlainZendeskSSOToken).not.toHaveBeenCalled();
        expect(
          lollipopActivationPortMock.getByFiscalCode,
        ).not.toHaveBeenCalled();
        expect(mockGetProfile).not.toHaveBeenCalled();
      },
    },
    {
      field: "bpdToken",
      expectedValue: mocks.aPlainBpdSSOToken,
      checkExpectations: () => {
        expect(mocks.toPlainBpdSSOToken).toHaveBeenCalledExactlyOnceWith(
          aPlainSessionToken,
        );
        expect(mocks.toPlainWalletSSOToken).not.toHaveBeenCalled();
        expect(mocks.toPlainFimsSSOToken).not.toHaveBeenCalled();
        expect(mocks.toExtendedPlainZendeskSSOToken).not.toHaveBeenCalled();
        expect(
          lollipopActivationPortMock.getByFiscalCode,
        ).not.toHaveBeenCalled();
        expect(mockGetProfile).not.toHaveBeenCalled();
      },
    },
    {
      field: "zendeskToken",
      expectedValue: mocks.anExtendedZendeskToken,
      checkExpectations: () => {
        expect(mockGetProfile).toHaveBeenCalledExactlyOnceWith(aFiscalCode);
        expect(
          mocks.toExtendedPlainZendeskSSOToken,
        ).toHaveBeenCalledExactlyOnceWith(aPlainSessionToken, anEmailAddress);
        expect(mocks.toPlainWalletSSOToken).not.toHaveBeenCalled();
        expect(mocks.toPlainBpdSSOToken).not.toHaveBeenCalled();
        expect(mocks.toPlainFimsSSOToken).not.toHaveBeenCalled();
        expect(
          lollipopActivationPortMock.getByFiscalCode,
        ).not.toHaveBeenCalled();
      },
    },
    {
      field: "fimsToken",
      expectedValue: mocks.aFimsSSOToken,
      checkExpectations: () => {
        expect(mocks.toPlainFimsSSOToken).toHaveBeenCalledExactlyOnceWith(
          aPlainSessionToken,
        );
        expect(mocks.toPlainWalletSSOToken).not.toHaveBeenCalled();
        expect(mocks.toPlainBpdSSOToken).not.toHaveBeenCalled();
        expect(mocks.toExtendedPlainZendeskSSOToken).not.toHaveBeenCalled();
        expect(
          lollipopActivationPortMock.getByFiscalCode,
        ).not.toHaveBeenCalled();
        expect(mockGetProfile).not.toHaveBeenCalled();
      },
    },
  ] as const satisfies ReadonlyArray<{
    field: GetSessionInput["fieldsFilter"][number];
    expectedValue: unknown;
    checkExpectations: () => void;
  }>;
  it.each(sessionFields)(
    "returns the requested $field field",
    async ({ field, expectedValue, checkExpectations }) => {
      // given
      if (field === "lollipopAssertionRef") {
        lollipopActivationPortMock.getByFiscalCode.mockResolvedValueOnce(
          ok(lollipopActivation),
        );
      }

      const input = {
        sessionId: aSessionId,
        sessionToken: aPlainSessionToken,
        fieldsFilter: [field],
      } satisfies GetSessionInput;

      // when
      const result = await getSession(input);

      // then
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toEqual({ [field]: expectedValue });
      }
      expect(mockFindBySessionToken).toHaveBeenCalledExactlyOnceWith({
        sessionId: aSessionId,
        hashedSessionToken: mocks.anHashedSessionToken,
      });
      expect(mocks.toHashedSessionToken).toHaveBeenCalledExactlyOnceWith(
        aPlainSessionToken,
      );
      checkExpectations();
    },
  );

  it("retrieves the Lollipop assertion only when requested", async () => {
    // given
    lollipopActivationPortMock.getByFiscalCode.mockResolvedValueOnce(
      ok(lollipopActivation),
    );

    const input = {
      sessionId: aSessionId,
      sessionToken: aPlainSessionToken,
      fieldsFilter: ["lollipopAssertionRef"] as const,
    } satisfies GetSessionInput;

    // when
    const result = await getSession(input);

    // then
    expect(result).toMatchObject(
      ok({ lollipopAssertionRef: lollipopActivation.assertionRef }),
    );
    expect(
      lollipopActivationPortMock.getByFiscalCode,
    ).toHaveBeenCalledExactlyOnceWith(aFiscalCode);
    expect(mockGetProfile).not.toHaveBeenCalled();
  });

  it("creates the extended Zendesk token only when requested", async () => {
    // given
    const input = {
      sessionId: aSessionId,
      sessionToken: aPlainSessionToken,
      fieldsFilter: ["zendeskToken"] as const,
    } satisfies GetSessionInput;

    // when
    const result = await getSession(input);

    // then
    expect(result).toEqual(ok({ zendeskToken: mocks.anExtendedZendeskToken }));
    expect(mockGetProfile).toHaveBeenCalledExactlyOnceWith(aFiscalCode);
    expect(
      mocks.toExtendedPlainZendeskSSOToken,
    ).toHaveBeenCalledExactlyOnceWith(aPlainSessionToken, anEmailAddress);
    expect(lollipopActivationPortMock.getByFiscalCode).not.toHaveBeenCalled();
  });

  it.each([
    ["the profile has no email", ok(aUserProfileWithoutEmail), undefined],
    [
      "the profile email is not validated",
      ok({
        ...aUserProfileWithoutEmail,
        email: anEmailAddress,
      }),
      undefined,
    ],
    ["the profile cannot be retrieved", err(aGenericError), undefined],
  ] as const)(
    "creates the extended Zendesk token without an email when %s",
    async (_scenario, profileResult, expectedEmail) => {
      // given
      mockGetProfile.mockResolvedValueOnce(profileResult);

      const input = {
        sessionId: aSessionId,
        sessionToken: aPlainSessionToken,
        fieldsFilter: ["zendeskToken"] as const,
      } satisfies GetSessionInput;

      // when
      const result = await getSession(input);

      // then
      expect(result).toEqual(
        ok({ zendeskToken: mocks.anExtendedZendeskToken }),
      );
      expect(mockGetProfile).toHaveBeenCalledExactlyOnceWith(aFiscalCode);
      expect(
        mocks.toExtendedPlainZendeskSSOToken,
      ).toHaveBeenCalledExactlyOnceWith(aPlainSessionToken, expectedEmail);
    },
  );

  it("maps a missing session to a generic session-not-found error", async () => {
    // given
    mockFindBySessionToken.mockResolvedValueOnce(err(aNotFoundError));

    const input = {
      sessionId: aSessionId,
      sessionToken: aPlainSessionToken,
      fieldsFilter: ["spidLevel"] as const,
    } satisfies GetSessionInput;

    // when
    const result = await getSession(input);

    // then
    expect(result).toEqual(err(new GenericError("Session not found")));
    expect(lollipopActivationPortMock.getByFiscalCode).not.toHaveBeenCalled();
    expect(mockGetProfile).not.toHaveBeenCalled();
  });

  it("maps a generic session retrieval error to a generic error", async () => {
    // given
    mockFindBySessionToken.mockResolvedValueOnce(err(aGenericError));

    const input = {
      sessionId: aSessionId,
      sessionToken: aPlainSessionToken,
      fieldsFilter: ["spidLevel"] as const,
    } satisfies GetSessionInput;

    // when
    const result = await getSession(input);

    // then
    expect(result).toEqual(
      err(new GenericError("An error occurred while retrieving the session")),
    );
    expect(lollipopActivationPortMock.getByFiscalCode).not.toHaveBeenCalled();
    expect(mockGetProfile).not.toHaveBeenCalled();
  });

  it("returns an error when the requested Lollipop activation cannot be retrieved", async () => {
    // given
    lollipopActivationPortMock.getByFiscalCode.mockResolvedValueOnce(
      err(aGenericError),
    );

    const input = {
      sessionId: aSessionId,
      sessionToken: aPlainSessionToken,
      fieldsFilter: ["lollipopAssertionRef"] as const,
    } satisfies GetSessionInput;

    // when
    const result = await getSession(input);

    // then
    expect(result).toEqual(
      err(
        new GenericError(
          "An error occurred while retrieving the lollipop activation",
        ),
      ),
    );
  });
});
