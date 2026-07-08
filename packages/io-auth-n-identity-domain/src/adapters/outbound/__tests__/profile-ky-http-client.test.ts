import { describe, it, expect, vi, beforeEach } from "vitest";
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
import { NewProfile } from "../../../domain/value-objects/profile/profile.vo.js";
import {
  aFiscalCode,
  mockedExtendedProfile,
} from "../../../domain/__mocks__/profile.mock.js";
import z from "zod";

const createHttpError = (status: number, statusText: string): HTTPError => {
  const response = new Response(null, { status, statusText });
  const request = new Request("https://api.example.com/profile");
  return new HTTPError(response, request, {} as NormalizedOptions);
};

const baseUrl = "https://api.example.com";
const basePath = "/api/v1";
const apiKey = "test-api-key";

const mockJson = vi.fn();
const mockKyInstance = {
  get: vi.fn(() => ({ json: mockJson })),
  post: vi.fn(() => ({ json: mockJson })),
} as unknown as typeof ky;

const mockNewProfilePayload: NewProfile = {
  is_email_validated: true,
};

const adapter = makeProfileKyClientAdapter(
  mockKyInstance,
  baseUrl,
  basePath,
  apiKey,
  z.object({ foo: z.string() }),
);

describe("getProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return ExtendedProfileSchema on 200 Success", async () => {
    mockJson.mockResolvedValueOnce(mockedExtendedProfile);

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
      mockJson.mockRejectedValueOnce(createHttpError(statusCode, "Error"));

      const result = await adapter.getProfile(aFiscalCode);

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toBeInstanceOf(error);
    },
  );

  it("should map decoding errors to GenericError", async () => {
    mockJson.mockRejectedValueOnce(
      new SchemaValidationError([{ message: "decode error" }]),
    );

    const result = await adapter.getProfile(aFiscalCode);

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toBeInstanceOf(GenericError);
    expect(result._unsafeUnwrapErr().message).toContain("Decoding error");
  });

  it("should map network/unknown errors to GenericError", async () => {
    mockJson.mockRejectedValueOnce(new Error("Network Failure"));

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
    mockJson.mockResolvedValueOnce(mockedExtendedProfile);

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
      mockJson.mockRejectedValueOnce(createHttpError(statusCode, "Error"));

      const result = await adapter.createProfile(
        aFiscalCode,
        mockNewProfilePayload,
      );

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toBeInstanceOf(error);
    },
  );

  it("should map decoding errors to GenericError", async () => {
    mockJson.mockRejectedValueOnce(
      new SchemaValidationError([{ message: "decode error" }]),
    );

    const result = await adapter.createProfile(
      aFiscalCode,
      mockNewProfilePayload,
    );

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toBeInstanceOf(GenericError);
    expect(result._unsafeUnwrapErr().message).toContain("Decoding error");
  });

  it("should map network/unknown errors to GenericError", async () => {
    mockJson.mockRejectedValueOnce(new Error("Network Failure"));

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
