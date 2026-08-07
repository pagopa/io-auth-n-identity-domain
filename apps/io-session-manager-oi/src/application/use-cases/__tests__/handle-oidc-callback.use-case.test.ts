import {
  AuthenticationError,
  GenericError,
  NonEmptyString,
  NotFoundError,
} from "@pagopa/hexagonal-core";
import { IPString } from "@pagopa/io-auth-n-identity-domain";
import { err, ok } from "neverthrow";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AusiliarDataPort } from "../../../domain/ports/outbound/ausiliar-data.port.js";
import { OidcPort } from "../../../domain/ports/outbound/oidc.port.js";
import { ClientSessionToken } from "../../../domain/value-objects/client-session-token.vo.js";
import { LoginAusiliarData } from "../../../domain/value-objects/login.vo.js";
import { OidcClaims } from "../../../domain/value-objects/oidc-claims.vo.js";
import { ActivateUserSessionUseCase } from "../activate-user-session.use-case.js";
import { makeHandleOidcCallbackUseCase } from "../handle-oidc-callback.use-case.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const IP_ADDRESS = "127.0.0.1" as IPString;
const STATE = "a-state" as NonEmptyString;
const CODE = "a-code" as NonEmptyString;

const QUERY = { code: CODE, state: STATE } as Readonly<Record<string, string>>;

const AUSILIAR_DATA = {
  loginType: "LV",
  currentUser: undefined,
  lollipopAssertionRef: "sha256-thumbprint",
  clientId: "a-client-id",
  minAuthLevel: "SpidL2",
  oidcConfigurationEnv: "PROD",
  nonce: "a-nonce",
} as unknown as LoginAusiliarData;

const CLAIMS = {
  fiscalNumber: "AAABBB01C02D345E",
  name: "Mario",
  familyName: "Rossi",
  email: "mario.rossi@example.com",
  dateOfBirth: new Date("1990-01-01"),
  acr: "https://www.spid.gov.it/SpidL2",
  iss: "https://oneid.example.com",
} as unknown as OidcClaims;

const CLIENT_SESSION_TOKEN =
  "session-id.plain-token" as unknown as ClientSessionToken;

const retrieveMock = vi.fn().mockResolvedValue(ok(AUSILIAR_DATA));
const ausiliarDataPort = {
  retrieve: retrieveMock,
} as unknown as AusiliarDataPort;

const exchangeMock = vi.fn().mockResolvedValue(ok(CLAIMS));
const oidcPort = {
  exchange: exchangeMock,
} as unknown as OidcPort;

const activateUserSessionUseCase = vi
  .fn()
  .mockResolvedValue(
    ok(CLIENT_SESSION_TOKEN),
  ) as unknown as ActivateUserSessionUseCase;

const handleOidcCallbackUseCase = makeHandleOidcCallbackUseCase({
  ausiliarDataPort,
  oidcPort,
  activateUserSessionUseCase,
});

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("makeHandleOidcCallbackUseCase", () => {
  it("retrieves ausiliar data, exchanges the code and activates the session", async () => {
    const result = await handleOidcCallbackUseCase({
      query: QUERY,
      ipAddress: IP_ADDRESS,
    });

    expect(retrieveMock).toHaveBeenCalledExactlyOnceWith(STATE);
    expect(exchangeMock).toHaveBeenCalledExactlyOnceWith({
      env: AUSILIAR_DATA.oidcConfigurationEnv,
      query: QUERY,
      expectedState: STATE,
      expectedNonce: AUSILIAR_DATA.nonce,
    });
    expect(activateUserSessionUseCase).toHaveBeenCalledExactlyOnceWith({
      fiscalCode: CLAIMS.fiscalNumber,
      name: CLAIMS.name,
      familyName: CLAIMS.familyName,
      dateOfBirth: CLAIMS.dateOfBirth,
      spidLevel: CLAIMS.acr,
      spidEmail: CLAIMS.email,
      ipAddress: IP_ADDRESS,
      loginType: AUSILIAR_DATA.loginType,
      identityProvider: CLAIMS.iss,
    });
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toBe(CLIENT_SESSION_TOKEN);
  });

  it("returns AuthenticationError when the callback query is invalid", async () => {
    const result = await handleOidcCallbackUseCase({
      query: { code: CODE } as Readonly<Record<string, string>>,
      ipAddress: IP_ADDRESS,
    });

    expect(result._unsafeUnwrapErr()).toBeInstanceOf(AuthenticationError);
    expect(retrieveMock).not.toHaveBeenCalled();
    expect(exchangeMock).not.toHaveBeenCalled();
    expect(activateUserSessionUseCase).not.toHaveBeenCalled();
  });

  it("returns AuthenticationError when the ausiliar data is not found", async () => {
    retrieveMock.mockResolvedValueOnce(
      err(new NotFoundError("ausiliar data", "ausiliar data not found")),
    );

    const result = await handleOidcCallbackUseCase({
      query: QUERY,
      ipAddress: IP_ADDRESS,
    });

    expect(result._unsafeUnwrapErr()).toBeInstanceOf(AuthenticationError);
    expect(exchangeMock).not.toHaveBeenCalled();
    expect(activateUserSessionUseCase).not.toHaveBeenCalled();
  });

  it("returns GenericError when the ausiliar data retrieval fails", async () => {
    retrieveMock.mockResolvedValueOnce(err(new GenericError("boom")));

    const result = await handleOidcCallbackUseCase({
      query: QUERY,
      ipAddress: IP_ADDRESS,
    });

    expect(result._unsafeUnwrapErr()).toBeInstanceOf(GenericError);
    expect(exchangeMock).not.toHaveBeenCalled();
    expect(activateUserSessionUseCase).not.toHaveBeenCalled();
  });

  it("propagates the error when the code exchange fails", async () => {
    const exchangeError = new AuthenticationError();
    exchangeMock.mockResolvedValueOnce(err(exchangeError));

    const result = await handleOidcCallbackUseCase({
      query: QUERY,
      ipAddress: IP_ADDRESS,
    });

    expect(result._unsafeUnwrapErr()).toBe(exchangeError);
    expect(activateUserSessionUseCase).not.toHaveBeenCalled();
  });
});
