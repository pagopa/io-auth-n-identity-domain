import {
  ConflictError,
  FiscalCodeSchema,
  ForbiddenError,
  GenericError,
  NonEmptyString,
  NotFoundError,
} from "@pagopa/hexagonal-core";
import {
  LollipopAssertionTypeSchema,
  LollipopAssertionRefSchema,
  LollipopJwk,
  LollipopJwkHashingAlgorithm,
  PubKeyStatusSchema,
} from "@pagopa/io-auth-n-identity-domain";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  type ActivatePubKeyPayloadDto,
  type GenerateLcParamsPayloadDto,
  type LcParamsDto,
  type NewPubKeyPayloadDto,
} from "../dtos/io-lollipop.dto.js";
import { createIoLollipopAdapter } from "../io-lollipop.adapter.js";
import {
  activatePubKey,
  generateLcParams,
  reservePubKey,
} from "../../../generated/io-lollipop/sdk.gen.js";

vi.mock("../../../generated/io-lollipop/client/index.js", () => ({
  createClient: vi.fn(() => ({
    interceptors: { request: { use: vi.fn() } },
  })),
}));

vi.mock("../../../generated/io-lollipop/sdk.gen.js", () => ({
  activatePubKey: vi.fn(),
  generateLcParams: vi.fn(),
  reservePubKey: vi.fn(),
}));

export const aPrivateJwk = {
  kty: "EC" as const,
  x: "NYvuK5KwdMSelFJgPnL0fsxizwOKw0WbQyANB4O6l2c",
  y: "qK9Zyso1CCwsUk985hnO5WEP3enSxpuD1n5JqtmZIEE",
  crv: "P-256" as const,
  d: "6l1RECpU4cjYqpBmAN44yUrMt7SWJmOIb9z2nn0mwEg",
  alg: "alg",
};

export const aPublicJwk = {
  kty: "EC" as const,
  x: "NYvuK5KwdMSelFJgPnL0fsxizwOKw0WbQyANB4O6l2c",
  y: "qK9Zyso1CCwsUk985hnO5WEP3enSxpuD1n5JqtmZIEE",
  crv: "P-256" as const,
  alg: "alg",
};

export const toEncodedJwk = (jwk: Record<string, string>): LollipopJwk =>
  Buffer.from(JSON.stringify(jwk)).toString("base64url") as LollipopJwk;

export const anEncodedJwk = toEncodedJwk(aPublicJwk);

const anAssertionRef = LollipopAssertionRefSchema.parse(
  "sha256-iwBFlFaCWaLnrCckGIyWMJBnfDkEJ-mgxZVzGICmkwU",
);

const aFiscalCode = FiscalCodeSchema.parse("ISPXNB32R82Y766D");

const aNewPubKeyPayload: NewPubKeyPayloadDto = {
  algo: "sha256" as LollipopJwkHashingAlgorithm,
  pub_key: aPublicJwk,
};

const anActivatePubKeyPayload: ActivatePubKeyPayloadDto = {
  fiscal_code: aFiscalCode,
  assertion_type: LollipopAssertionTypeSchema.enum.SAML,
  assertion: "a-signed-assertion" as NonEmptyString,
  expired_at: new Date("2026-01-01T22:00:00.000Z"),
};

const aGenerateLcParamsPayload: GenerateLcParamsPayloadDto = {
  operation_id: "an-operation-id" as NonEmptyString,
};

const aValidLCParamsResult: LcParamsDto = {
  assertion_ref: anAssertionRef,
  assertion_file_name: `${aFiscalCode}-${anAssertionRef}` as NonEmptyString,
  assertion_type: LollipopAssertionTypeSchema.enum.SAML,
  expired_at: "2026-01-01T22:00:00.000Z" as NonEmptyString,
  fiscal_code: aFiscalCode,
  pub_key: anEncodedJwk,
  status: PubKeyStatusSchema.enum.VALID,
  ttl: 1200,
  version: 1,
  lc_authentication_bearer: "aBearerTokenJWT" as NonEmptyString,
};

const adapter = createIoLollipopAdapter({
  baseUrl: "https://api.example.com",
  apiKey: "test-api-key",
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createIoLollipopAdapter#reservePubKey", () => {
  it("returns ok(undefined) on 201 Success", async () => {
    vi.mocked(reservePubKey).mockResolvedValue({
      data: undefined,
      error: undefined,
      response: { status: 201 } as Response,
    } as never);

    const result = await adapter.reservePubKey(aNewPubKeyPayload);

    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toBeUndefined();
  });

  it.each`
    status | errorClass
    ${400} | ${GenericError}
    ${403} | ${GenericError}
    ${409} | ${ConflictError}
    ${500} | ${GenericError}
  `(
    "returns err($errorClass.name) on $status",
    async ({ status, errorClass }) => {
      vi.mocked(reservePubKey).mockResolvedValue({
        data: undefined,
        error: {},
        response: { status } as Response,
      } as never);

      const result = await adapter.reservePubKey(aNewPubKeyPayload);

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toBeInstanceOf(errorClass);
    },
  );
});

describe("createIoLollipopAdapter#activatePubKey", () => {
  it("returns ok(assertionRef) on 200 Success", async () => {
    vi.mocked(activatePubKey).mockResolvedValue({
      data: undefined,
      error: undefined,
      response: { status: 200 } as Response,
    } as never);

    const result = await adapter.activatePubKey(
      anAssertionRef,
      anActivatePubKeyPayload,
    );

    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toEqual(anAssertionRef);
  });

  it.each`
    status | errorClass
    ${400} | ${GenericError}
    ${403} | ${GenericError}
    ${500} | ${GenericError}
  `(
    "returns err($errorClass.name) on $status",
    async ({ status, errorClass }) => {
      vi.mocked(activatePubKey).mockResolvedValue({
        data: undefined,
        error: {},
        response: { status } as Response,
      } as never);

      const result = await adapter.activatePubKey(
        anAssertionRef,
        anActivatePubKeyPayload,
      );

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toBeInstanceOf(errorClass);
    },
  );
});

describe("createIoLollipopAdapter#generateLCParams", () => {
  it("returns ok(LcParamsDto) on 200 Success", async () => {
    vi.mocked(generateLcParams).mockResolvedValue({
      data: aValidLCParamsResult,
      error: undefined,
      response: { status: 200 } as Response,
    } as never);

    const result = await adapter.generateLCParams(
      anAssertionRef,
      aGenerateLcParamsPayload,
    );

    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toEqual(aValidLCParamsResult);
  });

  it("returns err(GenericError) when response body is invalid", async () => {
    vi.mocked(generateLcParams).mockResolvedValue({
      data: { invalid: true },
      error: undefined,
      response: { status: 200 } as Response,
    } as never);

    const result = await adapter.generateLCParams(
      anAssertionRef,
      aGenerateLcParamsPayload,
    );

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toBeInstanceOf(GenericError);
  });

  it.each`
    status | errorClass
    ${400} | ${GenericError}
    ${403} | ${ForbiddenError}
    ${404} | ${NotFoundError}
    ${500} | ${GenericError}
  `(
    "returns err($errorClass.name) on $status",
    async ({ status, errorClass }) => {
      vi.mocked(generateLcParams).mockResolvedValue({
        data: undefined,
        error: {},
        response: { status } as Response,
      } as never);

      const result = await adapter.generateLCParams(
        anAssertionRef,
        aGenerateLcParamsPayload,
      );

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toBeInstanceOf(errorClass);
    },
  );
});
