import {
  AuthenticationError,
  FiscalCode,
  GenericError,
  NonEmptyString,
  NotFoundError,
  ValidationError,
} from "@pagopa/hexagonal-core";
import type {
  IPString,
  LollipopAssertionRef,
} from "@pagopa/io-auth-n-identity-domain";
import { DOMParser } from "@xmldom/xmldom";
import { toSha256 } from "@pagopa/io-auth-n-identity-session";
import { err, errAsync, ok, ResultAsync } from "neverthrow";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthEventPort } from "../../../domain/ports/outbound/auth-event.port.js";
import { AuxiliaryDataPort } from "../../../domain/ports/outbound/auxiliary-data.port.js";
import { IdentityAssertionFetcherPort } from "../../../domain/ports/outbound/identity-assertion-fetcher.port.js";
import { OidcClientPort } from "../../../domain/ports/outbound/oidc.port.js";
import type { IdentityAssertion } from "../../../domain/value-objects/assertion.vo.js";
import { ClientSessionToken } from "../../../domain/value-objects/client-session-token.vo.js";
import {
  CurrentUserSchema,
  LoginAuxiliaryData,
} from "../../../domain/value-objects/login.vo.js";
import { OidcClaims } from "../../../domain/value-objects/oidc.vo.js";
import { ActivateUserSessionUseCase } from "../activate-user-session.use-case.js";
import {
  makeHandleOidcCallbackUseCase,
  OidcCallbackParams,
} from "../handle-oidc-callback.use-case.js";
import {
  ProfileLockedError,
  TechnicalProfileLockedError,
  type ValidateProfileLocksUseCase,
} from "../validate-profile-locks.use-case.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const IP_ADDRESS = "127.0.0.1" as IPString;
const STATE = "a-state" as NonEmptyString;
const CODE = "a-code" as NonEmptyString;
const ACCESS_TOKEN = "an-access-token" as NonEmptyString;

const SUCCESS_CALLBACK = {
  code: CODE,
  state: STATE,
} as const satisfies OidcCallbackParams;

const ERROR_CALLBACK = {
  state: STATE,
  error: "access_denied" as NonEmptyString,
  error_description: "user aborted the login" as NonEmptyString,
} as const satisfies OidcCallbackParams;

const AUXILIARY_DATA = {
  loginType: "LV",
  currentUser: undefined,
  lollipopAssertionRef: "sha256-thumbprint",
  clientId: "a-client-id",
  minAuthLevel: "SpidL2",
  oidcConfigurationEnv: "PROD",
  nonce: "a-nonce",
} as unknown as LoginAuxiliaryData;

const CLAIMS = {
  fiscalNumber: "AAABBB01C02D345E",
  name: "Mario",
  familyName: "Rossi",
  email: "mario.rossi@example.com",
  dateOfBirth: new Date("1990-01-01"),
  acr: "https://www.spid.gov.it/SpidL2",
  iss: "https://oneid.example.com",
} as unknown as OidcClaims;

const IDENTITY_ASSERTION: IdentityAssertion = {
  assertionRef: AUXILIARY_DATA.lollipopAssertionRef,
  claims: { fiscalCode: CLAIMS.fiscalNumber },
  rawAssertion: "a-raw-saml-assertion" as NonEmptyString,
  assertion: new DOMParser().parseFromString(
    "<Assertion />",
    "application/xml",
  ),
  type: "SAML",
};

const CLIENT_SESSION_TOKEN =
  "session-id.plain-token" as unknown as ClientSessionToken;

const retrieveMock = vi.fn().mockResolvedValue(ok(AUXILIARY_DATA));
const auxiliaryDataPort = {
  retrieve: retrieveMock,
} as unknown as AuxiliaryDataPort;

const exchangeMock = vi
  .fn()
  .mockResolvedValue(ok({ claims: CLAIMS, accessToken: ACCESS_TOKEN }));
const oidcPort = {
  exchange: exchangeMock,
} as unknown as OidcClientPort;

const getAssertionMock = vi.fn().mockResolvedValue(ok(IDENTITY_ASSERTION));
const identityAssertionFetcherPort = {
  getAssertion: getAssertionMock,
} as unknown as IdentityAssertionFetcherPort;

const validateProfileLocksUseCase = vi
  .fn<ValidateProfileLocksUseCase>()
  .mockResolvedValue(ok(undefined));

const activateUserSessionUseCase = vi
  .fn()
  .mockResolvedValue(
    ok(CLIENT_SESSION_TOKEN),
  ) as unknown as ActivateUserSessionUseCase;

const sendEventMock = vi.fn<AuthEventPort["sendEvent"]>();

const handleOidcCallbackUseCase = makeHandleOidcCallbackUseCase({
  auxiliaryDataPort,
  oidcPort,
  identityAssertionFetcherPort,
  validateProfileLocksUseCase,
  activateUserSessionUseCase,
  authEventPort: { sendEvent: sendEventMock },
});

beforeEach(() => {
  retrieveMock.mockReset().mockResolvedValue(ok(AUXILIARY_DATA));
  exchangeMock
    .mockReset()
    .mockResolvedValue(ok({ claims: CLAIMS, accessToken: ACCESS_TOKEN }));
  getAssertionMock.mockReset().mockResolvedValue(ok(IDENTITY_ASSERTION));
  validateProfileLocksUseCase.mockReset().mockResolvedValue(ok(undefined));
  vi.mocked(activateUserSessionUseCase)
    .mockReset()
    .mockResolvedValue(ok(CLIENT_SESSION_TOKEN));
  sendEventMock
    .mockReset()
    .mockImplementation(() =>
      ResultAsync.fromSafePromise(Promise.resolve(undefined)),
    );
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("makeHandleOidcCallbackUseCase", () => {
  it("retrieves auxiliary data, exchanges the code and validates profile locks before activating the session", async () => {
    const result = await handleOidcCallbackUseCase({
      callback: SUCCESS_CALLBACK,
      ipAddress: IP_ADDRESS,
    });

    expect(retrieveMock).toHaveBeenCalledExactlyOnceWith(STATE);
    expect(exchangeMock).toHaveBeenCalledExactlyOnceWith({
      env: AUXILIARY_DATA.oidcConfigurationEnv,
      code: CODE,
      state: STATE,
      expectedNonce: AUXILIARY_DATA.nonce,
    });
    expect(getAssertionMock).toHaveBeenCalledExactlyOnceWith(
      AUXILIARY_DATA.oidcConfigurationEnv,
      ACCESS_TOKEN,
    );
    expect(validateProfileLocksUseCase).toHaveBeenCalledExactlyOnceWith({
      fiscalCode: CLAIMS.fiscalNumber,
      checks: ["user-set", "technical"],
    });
    expect(getAssertionMock.mock.invocationCallOrder[0]).toBeLessThan(
      validateProfileLocksUseCase.mock.invocationCallOrder[0],
    );
    expect(
      validateProfileLocksUseCase.mock.invocationCallOrder[0],
    ).toBeLessThan(
      vi.mocked(activateUserSessionUseCase).mock.invocationCallOrder[0],
    );
    expect(activateUserSessionUseCase).toHaveBeenCalledExactlyOnceWith({
      sessionToken: {
        fiscalCode: CLAIMS.fiscalNumber,
        name: CLAIMS.name,
        familyName: CLAIMS.familyName,
        dateOfBirth: CLAIMS.dateOfBirth,
        spidLevel: CLAIMS.acr,
        spidEmail: CLAIMS.email,
        ipAddress: IP_ADDRESS,
        loginType: AUXILIARY_DATA.loginType,
        idp: CLAIMS.iss,
      },
      assertion: {
        assertionRef: IDENTITY_ASSERTION.assertionRef,
        rawAssertion: IDENTITY_ASSERTION.rawAssertion,
        type: IDENTITY_ASSERTION.type,
      },
    });
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toEqual({
      outcome: "success",
      token: CLIENT_SESSION_TOKEN,
    });
    expect(sendEventMock).not.toHaveBeenCalled();
  });

  describe("current user validation", () => {
    const currentUser = toSha256("RSSMRA80A01H501U");

    beforeEach(() => {
      vi.spyOn(console, "warn").mockImplementation(() => undefined);
      vi.spyOn(console, "error").mockImplementation(() => undefined);
      retrieveMock.mockResolvedValueOnce(
        ok({ ...AUXILIARY_DATA, currentUser }),
      );
    });

    it.each([currentUser, currentUser.toUpperCase()])(
      "continues login when the parsed current user hash %s matches the authenticated fiscal code",
      async (hash) => {
        retrieveMock.mockReset().mockResolvedValueOnce(
          ok({
            ...AUXILIARY_DATA,
            currentUser: CurrentUserSchema.parse(hash),
          }),
        );
        exchangeMock.mockResolvedValueOnce(
          ok({
            claims: { ...CLAIMS, fiscalNumber: "RSSMRA80A01H501U" as FiscalCode },
            accessToken: ACCESS_TOKEN,
          }),
        );
        getAssertionMock.mockResolvedValueOnce(
          ok({
            ...IDENTITY_ASSERTION,
            claims: { fiscalCode: "RSSMRA80A01H501U" as FiscalCode },
          }),
        );

        const result = await handleOidcCallbackUseCase({
          callback: SUCCESS_CALLBACK,
          ipAddress: IP_ADDRESS,
        });

        expect(result._unsafeUnwrap()).toEqual({
          outcome: "success",
          token: CLIENT_SESSION_TOKEN,
        });
        expect(activateUserSessionUseCase).toHaveBeenCalledOnce();
        expect(sendEventMock).not.toHaveBeenCalled();
        expect(console.warn).not.toHaveBeenCalled();
      },
    );

    it("returns code 1004 and emits a rejected login event on a current-user mismatch", async () => {
      const startedAt = Date.now();
      const result = await handleOidcCallbackUseCase({
        callback: SUCCESS_CALLBACK,
        ipAddress: IP_ADDRESS,
      });

      expect(result._unsafeUnwrap()).toEqual({
        outcome: "error",
        errorCode: "1004",
      });
      expect(sendEventMock).toHaveBeenCalledExactlyOnceWith({
        eventType: "rejected_login",
        rejectionCause: "cf_mismatch",
        fiscalCode: CLAIMS.fiscalNumber,
        currentFiscalCodeHash: currentUser,
        ip: IP_ADDRESS,
        loginId: AUXILIARY_DATA.lollipopAssertionRef,
        ts: expect.any(Date),
      });
      const [event] = sendEventMock.mock.calls[0];
      expect(event.ts.getTime()).toBeGreaterThanOrEqual(startedAt);
      expect(event.ts.getTime()).toBeLessThanOrEqual(Date.now());
      expect(console.warn).toHaveBeenCalledExactlyOnceWith(
        "Current user mismatch between auxiliary data and id token",
      );
      expect(getAssertionMock).not.toHaveBeenCalled();
      expect(validateProfileLocksUseCase).not.toHaveBeenCalled();
      expect(activateUserSessionUseCase).not.toHaveBeenCalled();
    });

    it("does not wait for the rejected login event to finish sending", async () => {
      sendEventMock.mockReturnValueOnce(
        ResultAsync.fromSafePromise(new Promise<void>(() => undefined)),
      );

      const result = await handleOidcCallbackUseCase({
        callback: SUCCESS_CALLBACK,
        ipAddress: IP_ADDRESS,
      });

      expect(result._unsafeUnwrap()).toEqual({
        outcome: "error",
        errorCode: "1004",
      });
      expect(sendEventMock).toHaveBeenCalledOnce();
      expect(activateUserSessionUseCase).not.toHaveBeenCalled();
    });

    it("logs an event-send Err result without changing the login outcome", async () => {
      const sendError = new GenericError("Failed to send auth event");
      sendEventMock.mockReturnValueOnce(errAsync(sendError));

      const result = await handleOidcCallbackUseCase({
        callback: SUCCESS_CALLBACK,
        ipAddress: IP_ADDRESS,
      });

      expect(result._unsafeUnwrap()).toEqual({
        outcome: "error",
        errorCode: "1004",
      });
      await vi.waitFor(() => {
        expect(console.error).toHaveBeenCalledExactlyOnceWith(
          "Failed to send rejected_login (cf_mismatch) auth event:",
          sendError,
        );
      });
      expect(activateUserSessionUseCase).not.toHaveBeenCalled();
    });

    it("logs an unexpected event-send rejection without changing the login outcome", async () => {
      const sendError = new Error("Unexpected event-send rejection");
      sendEventMock.mockReturnValueOnce(
        ResultAsync.fromSafePromise(Promise.reject(sendError)),
      );

      const result = await handleOidcCallbackUseCase({
        callback: SUCCESS_CALLBACK,
        ipAddress: IP_ADDRESS,
      });

      expect(result._unsafeUnwrap()).toEqual({
        outcome: "error",
        errorCode: "1004",
      });
      await vi.waitFor(() => {
        expect(console.error).toHaveBeenCalledExactlyOnceWith(
          "Failed to send rejected_login (cf_mismatch) auth event:",
          sendError,
        );
      });
      expect(activateUserSessionUseCase).not.toHaveBeenCalled();
    });

    it("validates the authentication level before checking the current user", async () => {
      exchangeMock.mockResolvedValueOnce(
        ok({
          claims: { ...CLAIMS, acr: "https://www.spid.gov.it/SpidL1" },
          accessToken: ACCESS_TOKEN,
        }),
      );

      const result = await handleOidcCallbackUseCase({
        callback: SUCCESS_CALLBACK,
        ipAddress: IP_ADDRESS,
      });

      expect(result._unsafeUnwrapErr()).toBeInstanceOf(ValidationError);
      expect(sendEventMock).not.toHaveBeenCalled();
      expect(getAssertionMock).not.toHaveBeenCalled();
      expect(activateUserSessionUseCase).not.toHaveBeenCalled();
    });
  });

  it("validates the state then returns an error outcome on an OIDC error response", async () => {
    const result = await handleOidcCallbackUseCase({
      callback: ERROR_CALLBACK,
      ipAddress: IP_ADDRESS,
    });

    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toEqual({
      outcome: "error",
      errorCode: ERROR_CALLBACK.error,
      errorMessage: ERROR_CALLBACK.error_description,
    });
    expect(retrieveMock).toHaveBeenCalledExactlyOnceWith(STATE);
    expect(exchangeMock).not.toHaveBeenCalled();
    expect(getAssertionMock).not.toHaveBeenCalled();
    expect(validateProfileLocksUseCase).not.toHaveBeenCalled();
    expect(activateUserSessionUseCase).not.toHaveBeenCalled();
  });

  it.each([
    ["SpidL1", "SpidL1", true],
    ["SpidL1", "SpidL2", true],
    ["SpidL1", "SpidL3", true],
    ["SpidL2", "SpidL1", false],
    ["SpidL2", "SpidL2", true],
    ["SpidL2", "SpidL3", true],
    ["SpidL3", "SpidL1", false],
    ["SpidL3", "SpidL2", false],
    ["SpidL3", "SpidL3", true],
  ] as const)(
    "checks required %s against received %s (accepted: %s)",
    async (minAuthLevel, receivedLevel, accepted) => {
      retrieveMock.mockResolvedValueOnce(
        ok({ ...AUXILIARY_DATA, minAuthLevel }),
      );
      exchangeMock.mockResolvedValueOnce(
        ok({
          claims: {
            ...CLAIMS,
            acr: `https://www.spid.gov.it/${receivedLevel}`,
          },
          accessToken: ACCESS_TOKEN,
        }),
      );

      const result = await handleOidcCallbackUseCase({
        callback: SUCCESS_CALLBACK,
        ipAddress: IP_ADDRESS,
      });

      if (accepted) {
        expect(result._unsafeUnwrap()).toEqual({
          outcome: "success",
          token: CLIENT_SESSION_TOKEN,
        });
        expect(activateUserSessionUseCase).toHaveBeenCalledOnce();
        expect(validateProfileLocksUseCase).toHaveBeenCalledExactlyOnceWith({
          fiscalCode: CLAIMS.fiscalNumber,
          checks:
            receivedLevel === "SpidL3"
              ? ["technical"]
              : ["user-set", "technical"],
        });
      } else {
        expect(result._unsafeUnwrapErr()).toEqual(
          new ValidationError(
            `Insufficient SPID level: required ${minAuthLevel}, received ${receivedLevel}`,
          ),
        );
        expect(getAssertionMock).not.toHaveBeenCalled();
        expect(validateProfileLocksUseCase).not.toHaveBeenCalled();
        expect(activateUserSessionUseCase).not.toHaveBeenCalled();
      }
    },
  );

  it("rejects a fiscal number mismatch before activating a session", async () => {
    getAssertionMock.mockResolvedValueOnce(
      ok({
        ...IDENTITY_ASSERTION,
        claims: { fiscalCode: "RSSMRA80A01H501U" as FiscalCode },
      }),
    );

    const result = await handleOidcCallbackUseCase({
      callback: SUCCESS_CALLBACK,
      ipAddress: IP_ADDRESS,
    });

    expect(result._unsafeUnwrapErr()).toEqual(
      new ValidationError(
        "Fiscal number mismatch between id token and SAML identity assertion",
      ),
    );
    expect(validateProfileLocksUseCase).not.toHaveBeenCalled();
    expect(activateUserSessionUseCase).not.toHaveBeenCalled();
  });

  it("rejects an assertion reference mismatch before activating a session", async () => {
    getAssertionMock.mockResolvedValueOnce(
      ok({
        ...IDENTITY_ASSERTION,
        assertionRef: "another-assertion-ref" as LollipopAssertionRef,
      }),
    );

    const result = await handleOidcCallbackUseCase({
      callback: SUCCESS_CALLBACK,
      ipAddress: IP_ADDRESS,
    });

    expect(result._unsafeUnwrapErr()).toEqual(
      new ValidationError(
        "Assertion reference mismatch between auxiliary data and SAML identity assertion",
      ),
    );
    expect(validateProfileLocksUseCase).not.toHaveBeenCalled();
    expect(activateUserSessionUseCase).not.toHaveBeenCalled();
  });

  it("falls back to the generic error code when the provider omits the error", async () => {
    const result = await handleOidcCallbackUseCase({
      callback: { state: STATE },
      ipAddress: IP_ADDRESS,
    });

    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toEqual({
      outcome: "error",
      errorCode: "GENERIC_ERROR",
      errorMessage: undefined,
    });
    expect(exchangeMock).not.toHaveBeenCalled();
    expect(getAssertionMock).not.toHaveBeenCalled();
    expect(validateProfileLocksUseCase).not.toHaveBeenCalled();
    expect(activateUserSessionUseCase).not.toHaveBeenCalled();
  });

  it("returns AuthenticationError when the auxiliary data is not found", async () => {
    retrieveMock.mockResolvedValueOnce(
      err(new NotFoundError("auxiliary data", "auxiliary data not found")),
    );

    const result = await handleOidcCallbackUseCase({
      callback: SUCCESS_CALLBACK,
      ipAddress: IP_ADDRESS,
    });

    expect(result._unsafeUnwrapErr()).toBeInstanceOf(AuthenticationError);
    expect(exchangeMock).not.toHaveBeenCalled();
    expect(getAssertionMock).not.toHaveBeenCalled();
    expect(validateProfileLocksUseCase).not.toHaveBeenCalled();
    expect(activateUserSessionUseCase).not.toHaveBeenCalled();
  });

  it("returns GenericError when the auxiliary data retrieval fails", async () => {
    retrieveMock.mockResolvedValueOnce(err(new GenericError("boom")));

    const result = await handleOidcCallbackUseCase({
      callback: SUCCESS_CALLBACK,
      ipAddress: IP_ADDRESS,
    });

    expect(result._unsafeUnwrapErr()).toBeInstanceOf(GenericError);
    expect(exchangeMock).not.toHaveBeenCalled();
    expect(getAssertionMock).not.toHaveBeenCalled();
    expect(validateProfileLocksUseCase).not.toHaveBeenCalled();
    expect(activateUserSessionUseCase).not.toHaveBeenCalled();
  });

  it("propagates the error when the code exchange fails", async () => {
    const exchangeError = new AuthenticationError();
    exchangeMock.mockResolvedValueOnce(err(exchangeError));

    const result = await handleOidcCallbackUseCase({
      callback: SUCCESS_CALLBACK,
      ipAddress: IP_ADDRESS,
    });

    expect(result._unsafeUnwrapErr()).toBe(exchangeError);
    expect(validateProfileLocksUseCase).not.toHaveBeenCalled();
    expect(activateUserSessionUseCase).not.toHaveBeenCalled();
  });

  it("propagates assertion fetcher GenericError without activating the session", async () => {
    const fetchError = new GenericError("fetch failed");
    getAssertionMock.mockResolvedValueOnce(err(fetchError));

    const result = await handleOidcCallbackUseCase({
      callback: SUCCESS_CALLBACK,
      ipAddress: IP_ADDRESS,
    });

    expect(result._unsafeUnwrapErr()).toBe(fetchError);
    expect(validateProfileLocksUseCase).not.toHaveBeenCalled();
    expect(activateUserSessionUseCase).not.toHaveBeenCalled();
  });

  it("wraps assertion fetcher ValidationError as GenericError without activating the session", async () => {
    const fetchError = new ValidationError("invalid SAML assertion");
    getAssertionMock.mockResolvedValueOnce(err(fetchError));

    const result = await handleOidcCallbackUseCase({
      callback: SUCCESS_CALLBACK,
      ipAddress: IP_ADDRESS,
    });

    expect(result._unsafeUnwrapErr()).toBeInstanceOf(GenericError);
    expect(result._unsafeUnwrapErr()).not.toBeInstanceOf(ValidationError);
    expect(result._unsafeUnwrapErr()).toEqual(
      new GenericError(fetchError.message),
    );
    expect(validateProfileLocksUseCase).not.toHaveBeenCalled();
    expect(activateUserSessionUseCase).not.toHaveBeenCalled();
  });

  it("returns the authentication locked outcome without activating the session when the profile is locked", async () => {
    validateProfileLocksUseCase.mockResolvedValueOnce(
      err(new ProfileLockedError()),
    );

    const result = await handleOidcCallbackUseCase({
      callback: SUCCESS_CALLBACK,
      ipAddress: IP_ADDRESS,
    });

    expect(result._unsafeUnwrap()).toEqual({
      outcome: "error",
      errorCode: "1002",
    });
    expect(validateProfileLocksUseCase).toHaveBeenCalledExactlyOnceWith({
      fiscalCode: CLAIMS.fiscalNumber,
      checks: ["user-set", "technical"],
    });
    expect(activateUserSessionUseCase).not.toHaveBeenCalled();
  });

  it("propagates the technical profile lock without activating the session", async () => {
    const validationError = new TechnicalProfileLockedError();
    validateProfileLocksUseCase.mockResolvedValueOnce(err(validationError));

    const result = await handleOidcCallbackUseCase({
      callback: SUCCESS_CALLBACK,
      ipAddress: IP_ADDRESS,
    });

    expect(result._unsafeUnwrapErr()).toBe(validationError);
    expect(validateProfileLocksUseCase).toHaveBeenCalledExactlyOnceWith({
      fiscalCode: CLAIMS.fiscalNumber,
      checks: ["user-set", "technical"],
    });
    expect(activateUserSessionUseCase).not.toHaveBeenCalled();
  });

  it.each([
    "Error checking if profile is locked: storage unavailable",
    "Error checking if profile is technically locked: storage unavailable",
  ])(
    "logs and normalizes a validation failure without activating the session: %s",
    async (message) => {
      const validationError = new GenericError(message);
      const logSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => undefined);
      validateProfileLocksUseCase.mockResolvedValueOnce(err(validationError));

      try {
        const result = await handleOidcCallbackUseCase({
          callback: SUCCESS_CALLBACK,
          ipAddress: IP_ADDRESS,
        });

        expect(result._unsafeUnwrapErr()).toEqual(
          new GenericError("Error while validating user"),
        );
        expect(result._unsafeUnwrapErr()).not.toBe(validationError);
        expect(logSpy).toHaveBeenCalledExactlyOnceWith(
          "Error while validating user:",
          validationError,
        );
        expect(validateProfileLocksUseCase).toHaveBeenCalledExactlyOnceWith({
          fiscalCode: CLAIMS.fiscalNumber,
          checks: ["user-set", "technical"],
        });
        expect(activateUserSessionUseCase).not.toHaveBeenCalled();
      } finally {
        logSpy.mockRestore();
      }
    },
  );

  it("propagates activation errors unchanged", async () => {
    const activationError = new GenericError("activation failed");
    vi.mocked(activateUserSessionUseCase).mockResolvedValueOnce(
      err(activationError),
    );

    const result = await handleOidcCallbackUseCase({
      callback: SUCCESS_CALLBACK,
      ipAddress: IP_ADDRESS,
    });

    expect(result._unsafeUnwrapErr()).toBe(activationError);
  });
});
