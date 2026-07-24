import { AuthenticationError, GenericError } from "@pagopa/hexagonal-core";
import {
  LollipopAssertionRefSchema,
  LollipopJwk,
  LollipopMethodSchema,
  LollipopAssertionTypeSchema,
} from "@pagopa/io-auth-n-identity-domain";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createIoFastLoginAdapter } from "../io-fast-login.adapter.js";
import { fastLogin } from "../../../generated/io-fast-login/sdk.gen.js";
import {
  FastLoginParams,
  FastLoginParamsSchema,
} from "../../../domain/value-objects/fast-login.vo.js";

vi.mock("../../../generated/io-fast-login/client/client.gen.js", () => ({
  createClient: vi.fn(() => ({
    interceptors: { request: { use: vi.fn() } },
  })),
}));

vi.mock("../../../generated/io-fast-login/sdk.gen.js", () => ({
  fastLogin: vi.fn(),
}));

const aPublicJwk = {
  kty: "EC" as const,
  x: "NYvuK5KwdMSelFJgPnL0fsxizwOKw0WbQyANB4O6l2c",
  y: "qK9Zyso1CCwsUk985hnO5WEP3enSxpuD1n5JqtmZIEE",
  crv: "P-256" as const,
  alg: "alg",
};

const anEncodedJwk = Buffer.from(JSON.stringify(aPublicJwk)).toString(
  "base64url",
) as LollipopJwk;

const anAssertionRef = LollipopAssertionRefSchema.parse(
  "sha256-iwBFlFaCWaLnrCckGIyWMJBnfDkEJ-mgxZVzGICmkwU",
);

const aFastLoginPayload: FastLoginParams = FastLoginParamsSchema.parse({
  originalMethod: LollipopMethodSchema.enum.POST,
  originalUrl: "https://localhost/api/v1/fast-login",
  authJWT: "an-auth-jwt",
  assertionRef: anAssertionRef,
  assertionType: LollipopAssertionTypeSchema.enum.SAML,
  userId: "ISPXNB32R82Y766D",
  signature: "sig1=:AAAA:",
  signatureInput: 'sig1=("@method");created=1618884475',
  clientIp: "127.0.0.1",
  publicKey: anEncodedJwk,
});

const adapter = createIoFastLoginAdapter({
  baseUrl: "https://api.example.com",
  apiKey: "test-api-key",
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createIoFastLoginAdapter#fastLogin", () => {
  it("returns ok(saml_response) on 200 Success", async () => {
    vi.mocked(fastLogin).mockResolvedValue({
      data: { saml_response: "a-saml-response" },
      error: undefined,
      response: { status: 200 } as Response,
    } as never);

    const result = await adapter.fastLogin(aFastLoginPayload);

    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toEqual("a-saml-response");
  });

  it("returns err(GenericError) when response body is invalid", async () => {
    vi.mocked(fastLogin).mockResolvedValue({
      data: { foo: "bar" },
      error: undefined,
      response: { status: 200 } as Response,
    } as never);

    const result = await adapter.fastLogin(aFastLoginPayload);

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toBeInstanceOf(GenericError);
  });

  it.each`
    status | errorClass
    ${400} | ${GenericError}
    ${401} | ${AuthenticationError}
    ${500} | ${GenericError}
  `(
    "returns err($errorClass.name) on $status",
    async ({ status, errorClass }) => {
      vi.mocked(fastLogin).mockResolvedValue({
        data: undefined,
        error: {},
        response: { status } as Response,
      } as never);

      const result = await adapter.fastLogin(aFastLoginPayload);

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toBeInstanceOf(errorClass);
    },
  );
});
