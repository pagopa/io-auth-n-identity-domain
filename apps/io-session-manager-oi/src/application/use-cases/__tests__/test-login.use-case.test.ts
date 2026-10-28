import {
  AuthenticationError,
  ConflictError,
  GenericError,
  type NonEmptyString,
} from "@pagopa/hexagonal-core";
import type {
  IPString,
  JwkPublicKey,
  LollipopJwkHashingAlgorithm,
} from "@pagopa/io-auth-n-identity-domain";
import { err, ok } from "neverthrow";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockIsTestCredentials,
  resetTestUserPortMock,
  TestUserPortMock,
} from "../../../__mocks__/ports/test-user-port.mock.js";
import {
  aClientSessionToken,
  aFiscalCode,
  anIpAddress,
} from "../../../__mocks__/session.mocks.js";
import type { LollipopPort } from "../../../domain/ports/outbound/lollipop.port.js";
import { TEST_LOGIN_USER_DATA } from "../../../utils/test-login/index.js";
import type { ActivateUserSessionUseCase } from "../activate-user-session.use-case.js";
import { makeTestLoginUseCase } from "../test-login.use-case.js";

const aPublicKey: JwkPublicKey = {
  kty: "EC",
  x: "NYvuK5KwdMSelFJgPnL0fsxizwOKw0WbQyANB4O6l2c",
  y: "qK9Zyso1CCwsUk985hnO5WEP3enSxpuD1n5JqtmZIEE",
  crv: "P-256",
};
const anAssertionRef =
  "sha256-iwBFlFaCWaLnrCckGIyWMJBnfDkEJ-mgxZVzGICmkwU";

const input = {
  username: aFiscalCode,
  password: "a-password" as NonEmptyString,
  lollipopPublicKey: aPublicKey,
  lollipopHashAlgorithm: "sha256" as LollipopJwkHashingAlgorithm,
  loginType: "LV" as const,
  ipAddress: anIpAddress as IPString,
};

const mockReservePubKey = vi.fn();
const lollipopPort = {
  reservePubKey: mockReservePubKey,
} as unknown as LollipopPort;
const mockActivateUserSession = vi.fn();

const testLogin = makeTestLoginUseCase({
  testUserPort: TestUserPortMock,
  lollipopPort,
  activateUserSessionUseCase:
    mockActivateUserSession as unknown as ActivateUserSessionUseCase,
});

beforeEach(() => {
  resetTestUserPortMock();
  mockIsTestCredentials.mockReturnValue(true);
  mockReservePubKey.mockReset().mockResolvedValue(ok(anAssertionRef));
  mockActivateUserSession.mockReset().mockResolvedValue(ok(aClientSessionToken));
});

describe("TestLoginUseCase", () => {
  it("activates a session using a mocked SAML assertion bound to the reserved key", async () => {
    const result = await testLogin(input);

    expect(result).toEqual(ok({ accessToken: aClientSessionToken }));
    expect(mockIsTestCredentials).toHaveBeenCalledWith(
      input.username,
      input.password,
    );
    expect(mockReservePubKey).toHaveBeenCalledWith({
      algo: input.lollipopHashAlgorithm,
      pub_key: input.lollipopPublicKey,
    });
    expect(mockActivateUserSession).toHaveBeenCalledExactlyOnceWith({
      sessionToken: {
        fiscalCode: aFiscalCode,
        name: TEST_LOGIN_USER_DATA.name,
        familyName: TEST_LOGIN_USER_DATA.familyName,
        dateOfBirth: new Date(TEST_LOGIN_USER_DATA.dateOfBirth),
        spidLevel: TEST_LOGIN_USER_DATA.spidLevel,
        ipAddress: anIpAddress,
        loginType: "LV",
        identityProvider: TEST_LOGIN_USER_DATA.identityProvider,
      },
      assertion: {
        assertionRef: anAssertionRef,
        rawAssertion: expect.stringContaining(
          `InResponseTo="${anAssertionRef}"`,
        ),
        type: "SAML",
      },
    });
    const { rawAssertion } =
      mockActivateUserSession.mock.calls[0][0].assertion;
    expect(rawAssertion).toContain(`TINIT-${aFiscalCode}`);
  });

  it("returns an AuthenticationError for invalid credentials", async () => {
    mockIsTestCredentials.mockReturnValue(false);

    const result = await testLogin(input);

    expect(result._unsafeUnwrapErr()).toBeInstanceOf(AuthenticationError);
    expect(mockReservePubKey).not.toHaveBeenCalled();
    expect(mockActivateUserSession).not.toHaveBeenCalled();
  });

  it.each([
    [new ConflictError("conflict"), ConflictError],
    [new GenericError("boom"), GenericError],
  ])(
    "maps a reservePubKey %s failure",
    async (reserveError, expectedErrorClass) => {
      mockReservePubKey.mockResolvedValue(err(reserveError));

      const result = await testLogin(input);

      expect(result._unsafeUnwrapErr()).toBeInstanceOf(expectedErrorClass);
      expect(mockActivateUserSession).not.toHaveBeenCalled();
    },
  );

  it("propagates session activation failures", async () => {
    const anError = new GenericError("activation failed");
    mockActivateUserSession.mockResolvedValue(err(anError));

    const result = await testLogin(input);

    expect(result).toEqual(err(anError));
  });
});
