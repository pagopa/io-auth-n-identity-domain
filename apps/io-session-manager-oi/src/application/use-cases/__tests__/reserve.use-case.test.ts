import {
  ConflictError,
  GenericError,
  NonEmptyString,
  ValidationError,
} from "@pagopa/hexagonal-core";
import {
  JwkPublicKeyBase64UrlString,
  LollipopJwkHashingAlgorithm,
} from "@pagopa/io-auth-n-identity-domain";
import { err, ok } from "neverthrow";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AusiliarDataPort } from "../../../domain/ports/outbound/ausiliar-data.port.js";
import { LollipopPort } from "../../../domain/ports/outbound/lollipop.port.js";
import { OidcConfigPort } from "../../../domain/ports/outbound/oidc-config.port.js";
import {
  CurrentUser,
  LoginType,
  SpidAuthLevel,
} from "../../../domain/value-objects/login.vo.js";
import { makeReserveUseCase } from "../reserve.use-case.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const LOLLIPOP_PUBLIC_KEY = {
  kty: "EC" as const,
  x: "NYvuK5KwdMSelFJgPnL0fsxizwOKw0WbQyANB4O6l2c",
  y: "qK9Zyso1CCwsUk985hnO5WEP3enSxpuD1n5JqtmZIEE",
  crv: "P-256" as const,
  alg: "alg",
} as unknown as JwkPublicKeyBase64UrlString;

const LOLLIPOP_PUBLIC_KEY_THUMBPRINT =
  "iwBFlFaCWaLnrCckGIyWMJBnfDkEJ-mgxZVzGICmkwU";

const LOLLIPOP_HASH_ALGORITHM = "sha256" as LollipopJwkHashingAlgorithm;

const PROD_CLIENT_ID = "prod-client-id" as NonEmptyString;
const UAT_CLIENT_ID = "uat-client-id" as NonEmptyString;
const PROD_BASE_URL = new URL("https://prod.example.com");
const UAT_BASE_URL = new URL("https://uat.example.com");
const CLIENT_REDIRECT_URI = new URL("https://client.example.com/callback");

const MOCKED_RANDOM_BYTES = "a".repeat(24);
const MOCKED_HEX_RANDOM_BYTES =
  Buffer.from(MOCKED_RANDOM_BYTES).toString("hex");
vi.mock("node:crypto", () => {
  return { randomBytes: vi.fn(() => Buffer.from(MOCKED_RANDOM_BYTES)) };
});

const buildInput = (overrides = {}) => ({
  oidcConfigurationEnv: "PROD" as const,
  authLevel: "SpidL2" as SpidAuthLevel,
  lollipopPublicKey: LOLLIPOP_PUBLIC_KEY,
  lollipopHashAlgorithm: LOLLIPOP_HASH_ALGORITHM,
  loginType: "LV" as LoginType,
  currentUser: "a-current-user" as CurrentUser,
  ...overrides,
});

const reservePubKeyMock = vi.fn().mockResolvedValue(ok(undefined));
const lollipopClientRepository = {
  reservePubKey: reservePubKeyMock,
} as unknown as LollipopPort;

const saveMock = vi.fn().mockResolvedValue(ok(undefined));
const ausiliarDataRepository = {
  save: saveMock,
} as unknown as AusiliarDataPort;

const getConfigMock = vi.fn().mockImplementation((env: "PROD" | "UAT") =>
  env === "PROD"
    ? ok({
        clientId: PROD_CLIENT_ID,
        baseUrl: PROD_BASE_URL,
        redirectUri: CLIENT_REDIRECT_URI,
      })
    : ok({
        clientId: UAT_CLIENT_ID,
        baseUrl: UAT_BASE_URL,
        redirectUri: CLIENT_REDIRECT_URI,
      }),
);
const oidcConfigPort = {
  getConfig: getConfigMock,
} as unknown as OidcConfigPort;

const reserveUseCase = makeReserveUseCase({
  ausiliarDataRepository,
  lollipopClientRepository,
  oidcConfigPort,
});

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// success path
// ---------------------------------------------------------------------------

describe("makeReserveUseCase", () => {
  it("reserves the pubkey, saves ausiliar data and returns the OIDC parameters (PROD)", async () => {
    const input = buildInput();

    const result = await reserveUseCase(input);

    expect(reservePubKeyMock).toHaveBeenCalledExactlyOnceWith({
      algo: LOLLIPOP_HASH_ALGORITHM,
      pub_key: LOLLIPOP_PUBLIC_KEY,
    });
    expect(saveMock).toHaveBeenCalledExactlyOnceWith(MOCKED_HEX_RANDOM_BYTES, {
      minAuthLevel: input.authLevel,
      loginType: input.loginType,
      currentUser: input.currentUser,
      lollipopAssertionRef: `${LOLLIPOP_HASH_ALGORITHM}-${LOLLIPOP_PUBLIC_KEY_THUMBPRINT}`,
      clientId: PROD_CLIENT_ID,
    });

    expect(result.isOk()).toBe(true);
    const output = result._unsafeUnwrap();
    expect(output).toEqual({
      client_id: PROD_CLIENT_ID,
      state: MOCKED_HEX_RANDOM_BYTES,
      nonce: MOCKED_HEX_RANDOM_BYTES,
      redirect_uri: CLIENT_REDIRECT_URI.href,
      issuer: PROD_BASE_URL.href,
    });
  });

  it("uses the UAT client id and base url when configurationEnv is UAT", async () => {
    const input = buildInput({
      oidcConfigurationEnv: "UAT" as const,
    });

    const result = await reserveUseCase(input);

    expect(getConfigMock).toHaveBeenCalledExactlyOnceWith("UAT");
    expect(result.isOk()).toBe(true);
    const output = result._unsafeUnwrap();
    expect(output.client_id).toBe(UAT_CLIENT_ID);
    expect(output.issuer).toBe(UAT_BASE_URL.href);
  });

  it("returns err(ValidationError) when the OIDC config port has no configuration for the requested environment", async () => {
    const validationError = new ValidationError(
      'Missing OIDC configuration for environment "UAT"',
    );
    getConfigMock.mockReturnValueOnce(err(validationError));

    const input = buildInput({
      oidcConfigurationEnv: "UAT" as const,
    });

    const result = await reserveUseCase(input);

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toEqual(validationError);
    expect(reservePubKeyMock).not.toHaveBeenCalled();
    expect(saveMock).not.toHaveBeenCalled();
  });

  it("returns err(GenericError) when reservePubKey fails with a GenericError", async () => {
    reservePubKeyMock.mockResolvedValueOnce(err(new GenericError("boom")));

    const result = await reserveUseCase(buildInput());

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toEqual(
      new GenericError("cannot reserve pubkey"),
    );
    expect(saveMock).not.toHaveBeenCalled();
  });

  it("returns err(ConflictError) when reservePubKey fails with a ConflictError", async () => {
    reservePubKeyMock.mockResolvedValueOnce(
      err(new ConflictError("already reserved")),
    );

    const result = await reserveUseCase(buildInput());

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toEqual(
      new ConflictError("Pubkey is already reserved"),
    );
    expect(saveMock).not.toHaveBeenCalled();
  });

  it("returns err(GenericError) when saving ausiliar data fails", async () => {
    saveMock.mockResolvedValueOnce(err(new GenericError("save failed")));

    const result = await reserveUseCase(buildInput());

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toEqual(
      new GenericError("Could not save ausiliar data"),
    );
  });
});
