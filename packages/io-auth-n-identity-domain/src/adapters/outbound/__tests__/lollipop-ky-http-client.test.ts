import {
  ConflictError,
  ForbiddenError,
  GenericError,
  NonEmptyString,
  NotFoundError,
  ValidationError,
} from "@pagopa/hexagonal-core";
import ky, { HTTPError, NormalizedOptions, SchemaValidationError } from "ky";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { makeLollipopKyClientAdapter } from "../lollipop-ky-http-client.js";
import {
  ActivatedPubKeySchema,
  ActivatePubKeyPayloadSchema,
  GenerateLcParamsPayloadSchema,
  LcParamsSchema,
  NewPubKeyPayloadSchema,
  NewPubKeySchema,
} from "../../../domain/entities/lollipop/lollipop-pub-key.entity.js";
import { LollipopJwkHashingAlgorithm } from "../../../domain/index.js";
import { AssertionTypeEnum } from "../../../domain/value-objects/lollipop/lollipop-assertion-type.value-object.js";
import { PubKeyStatusEnum } from "../../../domain/value-objects/lollipop/lollipop-pub-key-status.value-object.js";
import {
  anAssertionRef,
  aPublicJwk,
  toEncodedJwk,
} from "../../../domain/__mocks__/lollipop.mock.js";
import { aFiscalCode } from "../../../domain/__mocks__/profile.mock.js";

const createHttpError = (status: number, statusText: string): HTTPError => {
  const response = new Response(null, { status, statusText });
  const request = new Request("https://api.example.com/lollipop");
  return new HTTPError(response, request, {} as NormalizedOptions);
};

const baseUrl = "https://api.example.com";
const basePath = "/api/v1";
const apiKey = "test-api-key";

const aBearerToken = "aBearerTokenJWT";

export const aNewPubKeyPayload: NewPubKeyPayloadSchema = {
  algo: "sha256" as LollipopJwkHashingAlgorithm,
  pub_key: aPublicJwk,
};

export const mockedNewPubKey: NewPubKeySchema = {
  assertion_ref: anAssertionRef,
  pub_key: toEncodedJwk(aPublicJwk),
  version: 0,
  status: PubKeyStatusEnum.PENDING,
  ttl: 900,
};

export const anActivatePubKeyPayload: ActivatePubKeyPayloadSchema = {
  fiscal_code: aFiscalCode,
  assertion_type: AssertionTypeEnum.SAML,
  assertion: "a-signed-assertion" as NonEmptyString,
  expired_at: new Date(),
};

export const anActivatedPubKey: ActivatedPubKeySchema = {
  assertion_ref: anAssertionRef,
  assertion_file_name: `${aFiscalCode}-${anAssertionRef}` as NonEmptyString,
  assertion_type: AssertionTypeEnum.SAML,
  expired_at: "2026-01-01T22:00:00.000Z" as NonEmptyString,
  fiscal_code: aFiscalCode,
  pub_key: toEncodedJwk(aPublicJwk),
  status: PubKeyStatusEnum.VALID,
  ttl: 1200,
  version: 1,
};

export const aGenerateLcParamsPayload: GenerateLcParamsPayloadSchema = {
  operation_id: "an-operation-id" as NonEmptyString,
};

export const aValidLCParamsResult: LcParamsSchema = {
  ...anActivatedPubKey,
  lc_authentication_bearer: aBearerToken as NonEmptyString,
};

const mockJson = vi.fn();
const mockKyInstance = {
  get: vi.fn(() => ({ json: mockJson })),
  post: vi.fn(() => ({ json: mockJson })),
  put: vi.fn(() => ({ json: mockJson })),
} as unknown as typeof ky;

const adapter = makeLollipopKyClientAdapter(
  mockKyInstance,
  baseUrl,
  basePath,
  apiKey,
);

describe("reservePubKey", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return pubkey on 201 Success", async () => {
    mockJson.mockResolvedValueOnce(mockedNewPubKey);

    const result = await adapter.reservePubKey(aNewPubKeyPayload);

    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toEqual(mockedNewPubKey);
    expect(mockKyInstance.post).toHaveBeenCalledWith(
      `${baseUrl}${basePath}/pubkeys`,
      {
        json: aNewPubKeyPayload,
        headers: { "X-Functions-Key": apiKey },
      },
    );
  });

  it.each`
    scenario              | error              | statusCode
    ${"Validation error"} | ${ValidationError} | ${400}
    ${"Forbidden"}        | ${ForbiddenError}  | ${403}
    ${"Conflict"}         | ${ConflictError}   | ${409}
    ${"Server error"}     | ${GenericError}    | ${500}
  `(
    "should return $error.name when $scenario (status $statusCode)",
    async ({ error, statusCode }) => {
      mockJson.mockRejectedValueOnce(createHttpError(statusCode, "Error"));

      const result = await adapter.reservePubKey(aNewPubKeyPayload);

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toBeInstanceOf(error);
    },
  );

  it("should map decoding errors to GenericError", async () => {
    mockJson.mockRejectedValueOnce(
      new SchemaValidationError([{ message: "decode error" }]),
    );

    const result = await adapter.reservePubKey(aNewPubKeyPayload);

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toBeInstanceOf(GenericError);
    expect(result._unsafeUnwrapErr().message).toContain("Decoding error");
  });

  it("should map network/unknown errors to GenericError", async () => {
    mockJson.mockRejectedValueOnce(new Error("Network Failure"));

    const result = await adapter.reservePubKey(aNewPubKeyPayload);

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toBeInstanceOf(GenericError);
    expect(result._unsafeUnwrapErr().message).toContain(
      "Network error while calling reservePubKey",
    );
  });
});

describe("activatePubKey", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return ActivatedPubKeySchema on 200 Success", async () => {
    mockJson.mockResolvedValueOnce(anActivatedPubKey);

    const result = await adapter.activatePubKey(
      anAssertionRef,
      anActivatePubKeyPayload,
    );

    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toEqual(anActivatedPubKey);
    expect(mockKyInstance.put).toHaveBeenCalledWith(
      `${baseUrl}${basePath}/pubKeys/${anAssertionRef}`,
      {
        json: anActivatePubKeyPayload,
        headers: { "X-Functions-Key": apiKey },
      },
    );
  });

  it.each`
    scenario              | error              | statusCode
    ${"Validation error"} | ${ValidationError} | ${400}
    ${"Forbidden"}        | ${ForbiddenError}  | ${403}
    ${"Server error"}     | ${GenericError}    | ${500}
  `(
    "should return $error.name when $scenario (status $statusCode)",
    async ({ error, statusCode }) => {
      mockJson.mockRejectedValueOnce(createHttpError(statusCode, "Error"));

      const result = await adapter.activatePubKey(
        anAssertionRef,
        anActivatePubKeyPayload,
      );

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toBeInstanceOf(error);
    },
  );

  it("should map decoding errors to GenericError", async () => {
    mockJson.mockRejectedValueOnce(
      new SchemaValidationError([{ message: "decode error" }]),
    );

    const result = await adapter.activatePubKey(
      anAssertionRef,
      anActivatePubKeyPayload,
    );

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toBeInstanceOf(GenericError);
    expect(result._unsafeUnwrapErr().message).toContain("Decoding error");
  });

  it("should map network/unknown errors to GenericError", async () => {
    mockJson.mockRejectedValueOnce(new Error("Network Failure"));

    const result = await adapter.activatePubKey(
      anAssertionRef,
      anActivatePubKeyPayload,
    );

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toBeInstanceOf(GenericError);
    expect(result._unsafeUnwrapErr().message).toContain(
      "Network error while calling activatePubKey",
    );
  });
});

describe("generateLCParams", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return LcParamsSchema on 200 Success", async () => {
    mockJson.mockResolvedValueOnce(aValidLCParamsResult);

    const result = await adapter.generateLCParams(
      anAssertionRef,
      aGenerateLcParamsPayload,
    );

    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toEqual(aValidLCParamsResult);
    expect(mockKyInstance.post).toHaveBeenCalledWith(
      `${baseUrl}${basePath}/pubKeys/${anAssertionRef}/generate`,
      {
        json: aGenerateLcParamsPayload,
        headers: { "X-Functions-Key": apiKey },
      },
    );
  });

  it.each`
    scenario              | error              | statusCode
    ${"Validation error"} | ${ValidationError} | ${400}
    ${"Forbidden"}        | ${ForbiddenError}  | ${403}
    ${"Not found"}        | ${NotFoundError}   | ${404}
    ${"Server error"}     | ${GenericError}    | ${500}
  `(
    "should return $error.name when $scenario (status $statusCode)",
    async ({ error, statusCode }) => {
      mockJson.mockRejectedValueOnce(createHttpError(statusCode, "Error"));

      const result = await adapter.generateLCParams(
        anAssertionRef,
        aGenerateLcParamsPayload,
      );

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toBeInstanceOf(error);
    },
  );

  it("should map decoding errors to GenericError", async () => {
    mockJson.mockRejectedValueOnce(
      new SchemaValidationError([{ message: "decode error" }]),
    );

    const result = await adapter.generateLCParams(
      anAssertionRef,
      aGenerateLcParamsPayload,
    );

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toBeInstanceOf(GenericError);
    expect(result._unsafeUnwrapErr().message).toContain("Decoding error");
  });

  it("should map network/unknown errors to GenericError", async () => {
    mockJson.mockRejectedValueOnce(new Error("Network Failure"));

    const result = await adapter.generateLCParams(
      anAssertionRef,
      aGenerateLcParamsPayload,
    );

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toBeInstanceOf(GenericError);
    expect(result._unsafeUnwrapErr().message).toContain(
      "Network error while calling generateLCParams",
    );
  });
});
