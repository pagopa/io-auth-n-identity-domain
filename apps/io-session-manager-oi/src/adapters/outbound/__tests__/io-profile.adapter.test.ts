import {
  FiscalCodeSchema,
  GenericError,
  NotFoundError,
} from "@pagopa/hexagonal-core";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createGetProfileAdapter } from "../io-profile.adapter.js";
import { getProfile } from "../../../generated/io-profile/sdk.gen.js";
import { ExtendedProfile } from "../../../generated/io-profile/types.gen.js";

vi.mock("../../../generated/io-profile/client/index.js", () => ({
  createClient: vi.fn(() => ({
    interceptors: { request: { use: vi.fn() } },
  })),
}));

vi.mock("../../../generated/io-profile/sdk.gen.js", () => ({
  getProfile: vi.fn(),
}));

const FISCAL_CODE = FiscalCodeSchema.parse("ISPXNB32R82Y766D");

const adapter = createGetProfileAdapter({
  baseUrl: "http://localhost",
  apiKey: "test-key",
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createGetProfileAdapter", () => {
  describe("200 OK", () => {
    it("returns ok(UserProfile) with email", async () => {
      vi.mocked(getProfile).mockResolvedValue({
        data: {
          is_email_validated: true,
          email: "user@example.com",
        } as unknown as ExtendedProfile,
        error: undefined,
        response: { status: 200 } as Response,
      });

      const result = await adapter.getProfile(FISCAL_CODE);

      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap()).toEqual({
        fiscalCode: FISCAL_CODE,
        email: "user@example.com",
        isEmailValidated: true,
      });
    });

    it("returns ok(UserProfile) without email", async () => {
      vi.mocked(getProfile).mockResolvedValue({
        data: { is_email_validated: false } as unknown as ExtendedProfile,
        error: undefined,
        response: { status: 200 } as Response,
      });

      const result = await adapter.getProfile(FISCAL_CODE);

      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap()).toEqual({
        fiscalCode: FISCAL_CODE,
        isEmailValidated: false,
      });
    });

    it("returns err(GenericError) when response body is invalid", async () => {
      vi.mocked(getProfile).mockResolvedValue({
        data: {
          is_email_validated: "not-a-boolean",
        } as unknown as ExtendedProfile,
        error: undefined,
        response: { status: 200 } as Response,
      });

      const result = await adapter.getProfile(FISCAL_CODE);

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toBeInstanceOf(GenericError);
    });
  });

  describe("error status codes", () => {
    it("returns err(GenericError) on 400", async () => {
      vi.mocked(getProfile).mockResolvedValue({
        data: undefined,
        error: {},
        response: { status: 400 } as Response,
      });

      const result = await adapter.getProfile(FISCAL_CODE);

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toBeInstanceOf(GenericError);
    });

    it("returns err(GenericError) on 401", async () => {
      vi.mocked(getProfile).mockResolvedValue({
        data: undefined,
        error: {},
        response: { status: 401 } as Response,
      });

      const result = await adapter.getProfile(FISCAL_CODE);

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toBeInstanceOf(GenericError);
    });

    it("returns err(NotFoundError) on 404", async () => {
      vi.mocked(getProfile).mockResolvedValue({
        data: undefined,
        error: { detail: "not found" },
        response: { status: 404 } as Response,
      });

      const result = await adapter.getProfile(FISCAL_CODE);

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toBeInstanceOf(NotFoundError);
    });

    it("returns err(GenericError) on 429", async () => {
      vi.mocked(getProfile).mockResolvedValue({
        data: undefined,
        error: {},
        response: { status: 429 } as Response,
      });

      const result = await adapter.getProfile(FISCAL_CODE);

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toBeInstanceOf(GenericError);
    });

    it("returns err(GenericError) on 500", async () => {
      vi.mocked(getProfile).mockResolvedValue({
        data: undefined,
        error: {},
        response: { status: 500 } as Response,
      });

      const result = await adapter.getProfile(FISCAL_CODE);

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toBeInstanceOf(GenericError);
    });
  });
});
