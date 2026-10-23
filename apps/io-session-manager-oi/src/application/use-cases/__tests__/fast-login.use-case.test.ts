import {
  AuthenticationError,
  FiscalCode,
  FiscalCodeSchema,
  ForbiddenError,
  NonEmptyStringSchema,
} from "@pagopa/hexagonal-core";
import {
  LollipopAssertionRefSchema,
  LollipopAssertionTypeSchema,
} from "@pagopa/io-auth-n-identity-domain";
import { ok } from "neverthrow";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FastLoginInputDTO } from "../../../adapters/inbound/dtos/fast-login.dto.js";
import { BlockedUsersPort } from "../../../domain/ports/outbound/blocked-users.port.js";
import { FastLoginPort } from "../../../domain/ports/outbound/fast-login.port.js";
import { FastLoginLollipopParams } from "../../../domain/value-objects/fast-login.vo.js";
import { makeFastLoginUseCase } from "../fast-login.use-case.js";
import { GenerateFastLoginLollipopParamsUseCase } from "../generate-fast-login-lollipop-params.use-case.js";
import { RefreshUserSessionUseCase } from "../refresh-user-session.use-case.js";

const THUMBPRINT = "a".repeat(43);
const ASSERTION_REF = LollipopAssertionRefSchema.parse(`sha256-${THUMBPRINT}`);
const FISCAL_CODE = "ISPXNB32R82Y766D";
const OTHER_FISCAL_CODE = FiscalCodeSchema.parse("RSSMRA85T10A562S");
const CLIENT_IP = "192.0.2.1";
const SAML_RESPONSE = `<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"><saml:Issuer>https://idp.example.test</saml:Issuer><saml:Assertion><saml:AttributeStatement><saml:Attribute Name="fiscalNumber"><saml:AttributeValue>${FISCAL_CODE}</saml:AttributeValue></saml:Attribute><saml:Attribute Name="name"><saml:AttributeValue>Mario</saml:AttributeValue></saml:Attribute><saml:Attribute Name="familyName"><saml:AttributeValue>Rossi</saml:AttributeValue></saml:Attribute><saml:Attribute Name="dateOfBirth"><saml:AttributeValue>1990-01-01</saml:AttributeValue></saml:Attribute></saml:AttributeStatement><saml:AuthnStatement><saml:AuthnContext><saml:AuthnContextClassRef>https://www.spid.gov.it/SpidL2</saml:AuthnContextClassRef></saml:AuthnContext></saml:AuthnStatement></saml:Assertion></samlp:Response>`;

const headers = FastLoginInputDTO.headers.parse({
  "x-pagopa-lollipop-original-method": "POST",
  "x-pagopa-lollipop-original-url": "https://api.example.test/session",
  "signature-input": `sig1=(\"x-pagopa-lollipop-original-method\");created=1618884475;keyid=\"${THUMBPRINT}\";nonce=\"a-nonce\"`,
  signature: "sig1=:AAAA:",
});
const signedRequest = {
  originalMethod: headers["x-pagopa-lollipop-original-method"],
  originalUrl: headers["x-pagopa-lollipop-original-url"],
  signatureInput: headers["signature-input"],
  signature: headers.signature,
};

const publicKey = Buffer.from(
  JSON.stringify({
    kty: "EC",
    crv: "P-256",
    x: "NYvuK5KwdMSelFJgPnL0fsxizwOKw0WbQyANB4O6l2c",
    y: "qK9Zyso1CCwsUk985hnO5WEP3enSxpuD1n5JqtmZIEE",
  }),
).toString("base64url");
const lollipop = {
  assertionRef: ASSERTION_REF,
  assertionType: LollipopAssertionTypeSchema.enum.SAML,
  authJWT: "a-bearer-token",
  userId: FISCAL_CODE,
  publicKey,
} as FastLoginLollipopParams;

const fastLogin = vi.fn();
const isBlocked = vi.fn();
const activateSession = vi.fn();
const resolveLollipop = vi.fn();

const fastLoginPort = {
  generateNonce: vi.fn(),
  fastLogin,
} as unknown as FastLoginPort;

const blockedUsersPort = {
  isBlocked,
} as unknown as BlockedUsersPort;

const refreshUserSessionUseCase =
  activateSession as unknown as RefreshUserSessionUseCase;
const generateFastLoginLollipopParamsUseCase =
  resolveLollipop as unknown as GenerateFastLoginLollipopParamsUseCase;

const makeUseCase = (enabled = true) =>
  makeFastLoginUseCase({
    fastLoginPort,
    blockedUsersPort,
    generateFastLoginLollipopParamsUseCase,
    refreshUserSessionUseCase,
    enabled,
  });

beforeEach(() => {
  vi.clearAllMocks();
  fastLogin.mockResolvedValue(ok(NonEmptyStringSchema.parse(SAML_RESPONSE)));
  isBlocked.mockResolvedValue(ok(false));
  resolveLollipop.mockResolvedValue(ok(lollipop));
  activateSession.mockResolvedValue(ok("session-id.token"));
});

describe("makeFastLoginUseCase", () => {
  it("resolves Lollipop data, calls Fast Login, then creates and returns a session", async () => {
    const result = await makeUseCase()({
      ...signedRequest,
      clientIp: CLIENT_IP,
      currentUser: FISCAL_CODE as FiscalCode,
    });
    expect(resolveLollipop).toHaveBeenCalledExactlyOnceWith({
      signatureInput: signedRequest.signatureInput,
      currentUser: FISCAL_CODE,
    });
    expect(fastLogin).toHaveBeenCalledExactlyOnceWith({
      originalMethod: "POST",
      originalUrl: "https://api.example.test/session",
      signature: "sig1=:AAAA:",
      signatureInput: signedRequest.signatureInput,
      assertionRef: ASSERTION_REF,
      assertionType: "SAML",
      authJWT: "a-bearer-token",
      clientIp: CLIENT_IP,
      publicKey,
      userId: FISCAL_CODE,
    });
    expect(activateSession).toHaveBeenCalledExactlyOnceWith({
      sessionToken: expect.objectContaining({
        fiscalCode: FISCAL_CODE,
        name: "Mario",
        familyName: "Rossi",
        ipAddress: CLIENT_IP,
        loginType: "LV",
      }),
    });
    expect(isBlocked).toHaveBeenCalledExactlyOnceWith(FISCAL_CODE);
    expect(result._unsafeUnwrap()).toEqual({ token: "session-id.token" });
  });

  it("rejects blocked users before activating a new session", async () => {
    isBlocked.mockResolvedValueOnce(ok(true));

    const result = await makeUseCase()({
      ...signedRequest,
      clientIp: CLIENT_IP,
      currentUser: FISCAL_CODE as FiscalCode,
    });

    expect(result._unsafeUnwrapErr()).toBeInstanceOf(AuthenticationError);
    expect(fastLogin).toHaveBeenCalledOnce();
    expect(activateSession).not.toHaveBeenCalled();
  });

  it("continues Fast Login without current session context", async () => {
    const result = await makeUseCase()({
      ...signedRequest,
      clientIp: CLIENT_IP,
    });

    expect(result).toEqual(ok({ token: "session-id.token" }));
    expect(resolveLollipop).toHaveBeenCalledExactlyOnceWith({
      signatureInput: signedRequest.signatureInput,
    });
    expect(activateSession).toHaveBeenCalledExactlyOnceWith({
      sessionToken: expect.objectContaining({
        fiscalCode: FISCAL_CODE,
        ipAddress: CLIENT_IP,
        loginType: "LV",
      }),
    });
  });

  it("rejects a SAML fiscal code that differs from the Lollipop user", async () => {
    resolveLollipop.mockResolvedValueOnce(
      ok({ ...lollipop, userId: OTHER_FISCAL_CODE }),
    );
    const result = await makeUseCase()({
      ...signedRequest,
      clientIp: CLIENT_IP,
      currentUser: FISCAL_CODE as FiscalCode,
    });

    expect(result._unsafeUnwrapErr()).toBeInstanceOf(AuthenticationError);
    expect(isBlocked).not.toHaveBeenCalled();
    expect(activateSession).not.toHaveBeenCalled();
  });

  it("rejects Fast Login when the boolean feature flag is disabled", async () => {
    const result = await makeUseCase(false)({
      ...signedRequest,
      clientIp: CLIENT_IP,
    });

    expect(result._unsafeUnwrapErr()).toBeInstanceOf(ForbiddenError);
    expect(fastLogin).not.toHaveBeenCalled();
    expect(resolveLollipop).not.toHaveBeenCalled();
    expect(activateSession).not.toHaveBeenCalled();
  });
});
