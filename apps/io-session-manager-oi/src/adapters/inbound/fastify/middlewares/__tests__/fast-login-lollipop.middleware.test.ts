import { ForbiddenError, ValidationError } from "@pagopa/hexagonal-core";
import {
  LollipopAssertionRefSchema,
  LollipopAssertionTypeSchema,
} from "@pagopa/io-auth-n-identity-domain";
import { LollipopActivationPort } from "@pagopa/io-auth-n-identity-session/ports";
import { err, ok } from "neverthrow";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LcParamsDto } from "../../../../outbound/dtos/io-lollipop.dto.js";
import { LollipopPort } from "../../../../../../domain/ports/outbound/lollipop.port.js";
import { FastLoginInputDTO } from "../../../dtos/fast-login.dto.js";
import { createFastLoginLollipopMiddleware } from "../fast-login-lollipop.middleware.js";

const THUMBPRINT = "a".repeat(43);
const ASSERTION_REF = LollipopAssertionRefSchema.parse(`sha256-${THUMBPRINT}`);
const SIGNATURE_INPUT = `sig1=(\"x-pagopa-lollipop-original-method\");created=1618884475;keyid=\"${THUMBPRINT}\";nonce=\"a-nonce\"`;
const headers = FastLoginInputDTO.headers.parse({
  "x-pagopa-lollipop-original-method": "POST",
  "x-pagopa-lollipop-original-url": "https://api.example.test/session",
  "signature-input": SIGNATURE_INPUT,
  signature: "sig1=:AAAA:",
});

const lcParams = {
  assertion_ref: ASSERTION_REF,
  assertion_file_name: "an-assertion-file",
  assertion_type: LollipopAssertionTypeSchema.enum.SAML,
  expired_at: "2030-01-01T00:00:00.000Z",
  fiscal_code: "ISPXNB32R82Y766D",
  pub_key: Buffer.from(
    JSON.stringify({
      kty: "EC",
      crv: "P-256",
      x: "NYvuK5KwdMSelFJgPnL0fsxizwOKw0WbQyANB4O6l2c",
      y: "qK9Zyso1CCwsUk985hnO5WEP3enSxpuD1n5JqtmZIEE",
    }),
  ).toString("base64url"),
  status: "VALID",
  ttl: 1200,
  version: 1,
  lc_authentication_bearer: "a-bearer-token",
} as LcParamsDto;

const generateLCParams = vi.fn();
const getByFiscalCode = vi.fn();
const middleware = createFastLoginLollipopMiddleware(
  {
    generateLCParams,
  } as unknown as LollipopPort,
  {
    getByFiscalCode,
  } as unknown as LollipopActivationPort,
);

const invoke = (requestHeaders: unknown, currentUser?: string) =>
  middleware({
    context: currentUser
      ? ({
          authenticated: true,
          value: { session: { fiscalCode: currentUser } },
        } as never)
      : { authenticated: false },
    payload: { headers: requestHeaders },
  });

beforeEach(() => {
  vi.clearAllMocks();
  generateLCParams.mockResolvedValue(ok(lcParams));
  getByFiscalCode.mockResolvedValue(
    ok({
      fiscalCode: lcParams.fiscal_code,
      assertionRef: ASSERTION_REF,
      expirationDate: new Date("2030-01-01T00:00:00.000Z"),
    }),
  );
});

describe("createFastLoginLollipopMiddleware", () => {
  it("resolves LC params from the signed request and adds typed context", async () => {
    const result = await invoke(headers);

    expect(generateLCParams).toHaveBeenCalledExactlyOnceWith(ASSERTION_REF, {
      operation_id: "a-nonce",
    });
    expect(getByFiscalCode).toHaveBeenCalledExactlyOnceWith(
      lcParams.fiscal_code,
    );
    expect(result._unsafeUnwrap()).toEqual({
      lollipop: {
        assertionRef: ASSERTION_REF,
        assertionType: "SAML",
        authJWT: "a-bearer-token",
        userId: "ISPXNB32R82Y766D",
        publicKey: lcParams.pub_key,
      },
    });
  });

  it("rejects malformed signed headers before calling Lollipop", async () => {
    const result = await invoke({ ...headers, signature: "invalid" });

    expect(result._unsafeUnwrapErr()).toBeInstanceOf(ValidationError);
    expect(generateLCParams).not.toHaveBeenCalled();
  });

  it("returns forbidden when no matching Lollipop key is found", async () => {
    generateLCParams.mockResolvedValueOnce(err(new ForbiddenError()));

    const result = await invoke(headers);

    expect(result._unsafeUnwrapErr()).toBeInstanceOf(ForbiddenError);
    expect(generateLCParams).toHaveBeenCalledExactlyOnceWith(ASSERTION_REF, {
      operation_id: "a-nonce",
    });
  });

  it("validates the current user's stored assertion reference", async () => {
    const result = await invoke(headers, lcParams.fiscal_code);

    expect(getByFiscalCode).toHaveBeenCalledExactlyOnceWith(
      lcParams.fiscal_code,
    );
    expect(generateLCParams).toHaveBeenCalledExactlyOnceWith(ASSERTION_REF, {
      operation_id: "a-nonce",
    });
    expect(result.isOk()).toBe(true);
  });

  it("rejects a current user when the stored assertion reference does not match the signature key", async () => {
    getByFiscalCode.mockResolvedValueOnce(
      ok({
        fiscalCode: lcParams.fiscal_code,
        assertionRef: LollipopAssertionRefSchema.parse(
          `sha256-${"b".repeat(43)}`,
        ),
        expirationDate: new Date("2030-01-01T00:00:00.000Z"),
      }),
    );

    const result = await invoke(headers, lcParams.fiscal_code);

    expect(result._unsafeUnwrapErr()).toBeInstanceOf(ForbiddenError);
    expect(generateLCParams).not.toHaveBeenCalled();
  });

  it("rejects anonymous lookup when the returned fiscal code does not own the signed key", async () => {
    getByFiscalCode.mockResolvedValueOnce(
      ok({
        fiscalCode: lcParams.fiscal_code,
        assertionRef: LollipopAssertionRefSchema.parse(
          `sha256-${"b".repeat(43)}`,
        ),
        expirationDate: new Date("2030-01-01T00:00:00.000Z"),
      }),
    );

    const result = await invoke(headers);

    expect(getByFiscalCode).toHaveBeenCalledExactlyOnceWith(
      lcParams.fiscal_code,
    );
    expect(result._unsafeUnwrapErr()).toBeInstanceOf(ForbiddenError);
  });
});
