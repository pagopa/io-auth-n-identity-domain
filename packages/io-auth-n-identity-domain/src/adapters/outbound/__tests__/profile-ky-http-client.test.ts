import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import ky, { HTTPError, NormalizedOptions, SchemaValidationError } from "ky";
import { makeProfileKyClientAdapter } from "../profile-ky-http-client.js";
import {
  AuthenticationError,
  ConflictError,
  GenericError,
  NotFoundError,
  TooManyRequestsError,
  ValidationError,
} from "@pagopa/hexagonal-core";
import { NewProfile } from "../../../domain/entities/profile.entity.js";
import {
  aFiscalCode,
  mockedExtendedProfile,
} from "../../../domain/__mocks__/profile.mock.js";

const createHttpError = (status: number, statusText: string): HTTPError => {
  const response = new Response(null, { status, statusText });
  const request = new Request("https://api.example.com/profile");
  return new HTTPError(response, request, {} as NormalizedOptions);
};

const baseUrl = "https://api.example.com";
const basePath = "/api/v1";
const apiKey = "test-api-key";

const mockKyInstance = {
  get: vi.fn(),
  post: vi.fn(),
} as unknown as typeof ky;

const mockNewProfilePayload: NewProfile = {
  is_email_validated: true,
};

const adapter = makeProfileKyClientAdapter(
  mockKyInstance,
  baseUrl,
  basePath,
  apiKey,
);

describe("getProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return ExtendedProfileSchema on 200 Success", async () => {
    vi.mocked(mockKyInstance.get).mockReturnValue({
      json: vi.fn().mockResolvedValue(mockedExtendedProfile),
    } as any);

    const result = await adapter.getProfile(aFiscalCode);

    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toEqual(mockedExtendedProfile);
    expect(mockKyInstance.get).toHaveBeenCalledWith(
      `${baseUrl}${basePath}/profiles/${aFiscalCode}`,
      { headers: { "X-Functions-Key": apiKey } },
    );
  });

  it.each`
    scenario                  | error                   | statusCode
    ${"Validation error"}     | ${ValidationError}      | ${400}
    ${"Authentication error"} | ${AuthenticationError}  | ${401}
    ${"Profile not found"}    | ${NotFoundError}        | ${404}
    ${"Rate limited"}         | ${TooManyRequestsError} | ${429}
    ${"Server error"}         | ${GenericError}         | ${500}
  `(
    "should return $error.name when $scenario (status $statusCode)",
    async ({ error, statusCode }) => {
      vi.mocked(mockKyInstance.get).mockReturnValue({
        json: vi.fn().mockRejectedValue(createHttpError(statusCode, "Error")),
      } as any);

      const result = await adapter.getProfile(aFiscalCode);

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toBeInstanceOf(error);
    },
  );

  it("should map decoding errors to GenericError", async () => {
    vi.mocked(mockKyInstance.get).mockReturnValue({
      json: vi
        .fn()
        .mockRejectedValue(
          new SchemaValidationError([{ message: "decode error" }]),
        ),
    } as any);

    const result = await adapter.getProfile(aFiscalCode);

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toBeInstanceOf(GenericError);
    expect(result._unsafeUnwrapErr().message).toContain("Decoding error");
  });

  it("should map network/unknown errors to GenericError", async () => {
    vi.mocked(mockKyInstance.get).mockReturnValue({
      json: vi.fn().mockRejectedValue(new Error("Network Failure")),
    } as any);

    const result = await adapter.getProfile(aFiscalCode);

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toBeInstanceOf(GenericError);
    expect(result._unsafeUnwrapErr().message).toContain(
      "Network error while calling getProfile",
    );
  });
});

describe("createProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return ExtendedProfileSchema on 201/200 Success", async () => {
    vi.mocked(mockKyInstance.post).mockReturnValue({
      json: vi.fn().mockResolvedValue(mockedExtendedProfile),
    } as any);

    const result = await adapter.createProfile(
      aFiscalCode,
      mockNewProfilePayload,
    );

    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toEqual(mockedExtendedProfile);
    expect(mockKyInstance.post).toHaveBeenCalledWith(
      `${baseUrl}${basePath}/profiles/${aFiscalCode}`,
      {
        json: mockNewProfilePayload,
        headers: { "X-Functions-Key": apiKey },
      },
    );
  });

  it.each`
    scenario                  | error                   | statusCode
    ${"Validation error"}     | ${ValidationError}      | ${400}
    ${"Authentication error"} | ${AuthenticationError}  | ${401}
    ${"Profile conflict"}     | ${ConflictError}        | ${409}
    ${"Rate limited"}         | ${TooManyRequestsError} | ${429}
    ${"Bad request"}          | ${GenericError}         | ${500}
  `(
    "should return $error.name when $scenario (status $statusCode)",
    async ({ error, statusCode }) => {
      vi.mocked(mockKyInstance.post).mockReturnValue({
        json: vi.fn().mockRejectedValue(createHttpError(statusCode, "Error")),
      } as any);

      const result = await adapter.createProfile(
        aFiscalCode,
        mockNewProfilePayload,
      );

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toBeInstanceOf(error);
    },
  );

  it("should map decoding errors to GenericError", async () => {
    vi.mocked(mockKyInstance.post).mockReturnValue({
      json: vi
        .fn()
        .mockRejectedValue(
          new SchemaValidationError([{ message: "decode error" }]),
        ),
    } as any);

    const result = await adapter.createProfile(
      aFiscalCode,
      mockNewProfilePayload,
    );

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toBeInstanceOf(GenericError);
    expect(result._unsafeUnwrapErr().message).toContain("Decoding error");
  });

  it("should map network/unknown errors to GenericError", async () => {
    vi.mocked(mockKyInstance.post).mockReturnValue({
      json: vi.fn().mockRejectedValue(new Error("Network Failure")),
    } as any);

    const result = await adapter.createProfile(
      aFiscalCode,
      mockNewProfilePayload,
    );

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toBeInstanceOf(GenericError);
    expect(result._unsafeUnwrapErr().message).toContain(
      "Network error while calling createProfile",
    );
  });
});
