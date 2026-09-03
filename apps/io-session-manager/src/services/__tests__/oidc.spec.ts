import { describe, test, expect, vi, afterEach } from "vitest";
import * as E from "fp-ts/Either";
import { JwkPublicKey } from "@pagopa/ts-commons/lib/jwk";

import { reserve } from "../oidc";
import { ReserveInput } from "../../types/oidc";
import {
  mockRedisClientSelector,
  mockSetEx,
} from "../../__mocks__/redis.mocks";
import { getOidcConfiguration } from "../../repositories/oidc-client";
import * as OneIdConfig from "../../config/one-id";
import { JwkPubKeyHashAlgorithmEnum } from "../../generated/lollipop-api/JwkPubKeyHashAlgorithm";

vi.mock("../../repositories/oidc-client", () => ({
  getOidcConfiguration: vi.fn(),
}));

const mockedGetOidcConfiguration = vi.mocked(getOidcConfiguration);

const aJwk = {
  kty: "EC",
  crv: "P-256",
  x: "4f30zuGMrodEywpJ1zVJmaQ-V-fS89VAMo2fszulNNk",
  y: "lnMva1zx1hRgqV9zuDSwdWGrRXSDIxQt5aRUxmDUn84",
} as unknown as JwkPublicKey;

const aServerMetadata = { issuer: "https://prod.oneid.pagopa.it/" };
const anOidcConfiguration = {
  serverMetadata: () => aServerMetadata,
};

const aReserveInput: ReserveInput = {
  env: "PROD",
  authLevel: "SpidL2",
  jwk: aJwk,
  jwkPubKeyHashAlgorithm: JwkPubKeyHashAlgorithmEnum.sha256,
};

const deps = {
  redisClientSelector: mockRedisClientSelector,
};

describe("OidcService#reserve", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  test("should compute the lollipop assertion ref, save the ausiliar data and return the OIDC parameters", async () => {
    mockedGetOidcConfiguration.mockResolvedValueOnce(
      anOidcConfiguration as never,
    );
    mockSetEx.mockResolvedValueOnce("OK");

    const result = await reserve(deps)(aReserveInput);

    expect(mockSetEx).toHaveBeenCalledWith(
      expect.stringContaining("RESERVE-"),
      expect.any(Number),
      expect.stringContaining('"lollipopAssertionRef":"sha256-'),
    );
    expect(result.kind).toEqual("IResponseSuccessJson");
    if (result.kind === "IResponseSuccessJson") {
      expect(result.value).toMatchObject({
        client_id: "prod-client-id",
        issuer: aServerMetadata.issuer,
        redirect_uri: "https://localhost/api/auth/v2/callback",
      });
      expect(result.value.state).toEqual(expect.any(String));
      expect(result.value.nonce).toEqual(expect.any(String));
    }
  });

  test("should return IResponseErrorValidation when the requested environment is not a valid OidcConfigurationEnv", async () => {
    const result = await reserve(deps)({
      ...aReserveInput,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      env: "FOO" as any,
    });

    expect(result.kind).toEqual("IResponseErrorValidation");
    expect(mockSetEx).not.toHaveBeenCalled();
  });

  test("should return IResponseErrorValidation when UAT is requested but only PROD is configured", async () => {
    // Simulates a deployment where only the PROD OneIdentity environment
    // vars are set (UAT is optional), exercising the
    // real `getOidcEnvConfig` "missing configuration" branch (as opposed to
    // the "FOO" case above, which never reaches a valid
    // OidcConfigurationEnv in the first place).
    const getOidcEnvConfigSpy = vi
      .spyOn(OneIdConfig, "getOidcEnvConfig")
      .mockReturnValueOnce(
        E.left(new Error('Missing OIDC configuration for environment "UAT"')),
      );

    const result = await reserve(deps)({
      ...aReserveInput,
      env: "UAT",
    });

    expect(result.kind).toEqual("IResponseErrorValidation");
    expect(mockedGetOidcConfiguration).not.toHaveBeenCalled();
    expect(mockSetEx).not.toHaveBeenCalled();

    getOidcEnvConfigSpy.mockRestore();
  });

  test("should return IResponseErrorInternal when OIDC discovery fails", async () => {
    mockedGetOidcConfiguration.mockRejectedValueOnce(
      new Error("discovery failed"),
    );

    const result = await reserve(deps)(aReserveInput);

    expect(result.kind).toEqual("IResponseErrorInternal");
    expect(mockSetEx).not.toHaveBeenCalled();
  });

  test("should return IResponseErrorInternal when saving the ausiliar data fails", async () => {
    mockedGetOidcConfiguration.mockResolvedValueOnce(
      anOidcConfiguration as never,
    );
    mockSetEx.mockRejectedValueOnce(new Error("redis error"));

    const result = await reserve(deps)(aReserveInput);

    expect(result.kind).toEqual("IResponseErrorInternal");
  });
});
