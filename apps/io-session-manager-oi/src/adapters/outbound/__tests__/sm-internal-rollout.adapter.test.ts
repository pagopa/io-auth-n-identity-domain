import {
  FiscalCodeSchema,
  GenericError,
  NotFoundError,
} from "@pagopa/hexagonal-core";
import { LollipopAssertionRefSchema } from "@pagopa/io-auth-n-identity-domain";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { type LollipopActivationDto } from "../dtos/sm-internal-rollout.dto.js";
import { createSmInternalRolloutAdapter } from "../sm-internal-rollout.adapter.js";
import {
  getUserLollipopActivation,
  softDeleteUserSession,
} from "../../../generated/io-session-manager-internal/sdk.gen.js";

vi.mock(
  "../../../generated/io-session-manager-internal/client/index.js",
  () => ({
    createClient: vi.fn(() => ({
      interceptors: { request: { use: vi.fn() } },
    })),
  }),
);

vi.mock("../../../generated/io-session-manager-internal/sdk.gen.js", () => ({
  getUserLollipopActivation: vi.fn(),
  softDeleteUserSession: vi.fn(),
}));

const aFiscalCode = FiscalCodeSchema.parse("ISPXNB32R82Y766D");

const anAssertionRef = LollipopAssertionRefSchema.parse(
  "sha256-iwBFlFaCWaLnrCckGIyWMJBnfDkEJ-mgxZVzGICmkwU",
);

const aLollipopActivation: LollipopActivationDto = {
  assertion_ref: anAssertionRef,
};

const adapter = createSmInternalRolloutAdapter({
  baseUrl: "https://api.example.com",
  apiKey: "test-api-key",
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createSmInternalRolloutAdapter#softDeleteUserSession", () => {
  it("returns ok(undefined) on 200 Success", async () => {
    vi.mocked(softDeleteUserSession).mockResolvedValue({
      data: undefined,
      error: undefined,
      response: { status: 200 } as Response,
    } as never);

    const result = await adapter.softDeleteUserSession(aFiscalCode);

    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toBeUndefined();
  });

  it.each`
    status | errorClass
    ${400} | ${GenericError}
    ${401} | ${GenericError}
    ${500} | ${GenericError}
  `(
    "returns err($errorClass.name) on $status",
    async ({ status, errorClass }) => {
      vi.mocked(softDeleteUserSession).mockResolvedValue({
        data: undefined,
        error: {},
        response: { status } as Response,
      } as never);

      const result = await adapter.softDeleteUserSession(aFiscalCode);

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toBeInstanceOf(errorClass);
    },
  );
});

describe("createSmInternalRolloutAdapter#getUserLollipopActivation", () => {
  it("returns ok(LollipopActivationDto) on 200 Success", async () => {
    vi.mocked(getUserLollipopActivation).mockResolvedValue({
      data: aLollipopActivation,
      error: undefined,
      response: { status: 200 } as Response,
    } as never);

    const result = await adapter.getUserLollipopActivation(aFiscalCode);

    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toEqual(aLollipopActivation.assertion_ref);
  });

  it("returns err(GenericError) when response body is invalid", async () => {
    vi.mocked(getUserLollipopActivation).mockResolvedValue({
      data: { invalid: true },
      error: undefined,
      response: { status: 200 } as Response,
    } as never);

    const result = await adapter.getUserLollipopActivation(aFiscalCode);

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toBeInstanceOf(GenericError);
  });

  it.each`
    status | errorClass
    ${400} | ${GenericError}
    ${401} | ${GenericError}
    ${404} | ${NotFoundError}
    ${500} | ${GenericError}
  `(
    "returns err($errorClass.name) on $status",
    async ({ status, errorClass }) => {
      vi.mocked(getUserLollipopActivation).mockResolvedValue({
        data: undefined,
        error: {},
        response: { status } as Response,
      } as never);

      const result = await adapter.getUserLollipopActivation(aFiscalCode);

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toBeInstanceOf(errorClass);
    },
  );
});
