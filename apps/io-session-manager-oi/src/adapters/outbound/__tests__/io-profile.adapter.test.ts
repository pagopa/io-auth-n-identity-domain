import {
  ConflictError,
  EmailAddress,
  FiscalCodeSchema,
  GenericError,
  NotFoundError,
} from "@pagopa/hexagonal-core";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { UserProfile } from "../../../domain/entities/profile.entity.js";
import { createIoProfileAdapter } from "../io-profile.adapter.js";
import {
  createProfile,
  getProfile,
} from "../../../generated/io-profile/sdk.gen.js";
import { ExtendedProfile } from "../../../generated/io-profile/types.gen.js";

vi.mock("../../../generated/io-profile/client/index.js", () => ({
  createClient: vi.fn(() => ({
    interceptors: { request: { use: vi.fn() } },
  })),
}));

vi.mock("../../../generated/io-profile/sdk.gen.js", () => ({
  createProfile: vi.fn(),
  getProfile: vi.fn(),
}));

const FISCAL_CODE = FiscalCodeSchema.parse("ISPXNB32R82Y766D");

const adapter = createIoProfileAdapter({
  baseUrl: "http://localhost",
  apiKey: "test-key",
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createIoProfileAdapter#getProfile", () => {
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
    it.each`
      status | errorClass
      ${400} | ${GenericError}
      ${401} | ${GenericError}
      ${404} | ${NotFoundError}
      ${429} | ${GenericError}
      ${500} | ${GenericError}
    `(
      "returns err($errorClass.name) on $status",
      async ({ status, errorClass }) => {
        vi.mocked(getProfile).mockResolvedValue({
          data: undefined,
          error: {},
          response: { status } as Response,
        });

        const result = await adapter.getProfile(FISCAL_CODE);

        expect(result.isErr()).toBe(true);
        expect(result._unsafeUnwrapErr()).toBeInstanceOf(errorClass);
      },
    );
  });
});

describe("createIoProfileAdapter#create", () => {
  const newProfile: UserProfile = {
    fiscalCode: FISCAL_CODE,
    email: "user@example.com" as EmailAddress,
    isEmailValidated: false,
  };

  describe("200 OK", () => {
    it("returns ok(UserProfile) with email", async () => {
      vi.mocked(createProfile).mockResolvedValue({
        data: {
          is_email_validated: false,
          email: "user@example.com",
        } as unknown as ExtendedProfile,
        error: undefined,
        response: { status: 200 } as Response,
      });

      const result = await adapter.create(newProfile);

      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap()).toEqual({
        fiscalCode: FISCAL_CODE,
        email: "user@example.com",
        isEmailValidated: false,
      });
    });

    it("returns err(GenericError) when response body is invalid", async () => {
      vi.mocked(createProfile).mockResolvedValue({
        data: {
          is_email_validated: "not-a-boolean",
        } as unknown as ExtendedProfile,
        error: undefined,
        response: { status: 200 } as Response,
      });

      const result = await adapter.create(newProfile);

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toBeInstanceOf(GenericError);
    });
  });

  describe("error status codes", () => {
    it.each`
      status | errorClass
      ${400} | ${GenericError}
      ${401} | ${GenericError}
      ${409} | ${ConflictError}
      ${429} | ${GenericError}
    `(
      "returns err($errorClass.name) on $status",
      async ({ status, errorClass }) => {
        vi.mocked(createProfile).mockResolvedValue({
          data: undefined,
          error: {},
          response: { status } as Response,
        });

        const result = await adapter.create(newProfile);

        expect(result.isErr()).toBe(true);
        expect(result._unsafeUnwrapErr()).toBeInstanceOf(errorClass);
      },
    );
  });
});
