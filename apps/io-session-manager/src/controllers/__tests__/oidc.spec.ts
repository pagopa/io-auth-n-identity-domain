import { describe, test, expect, vi, afterEach } from "vitest";
import { Request } from "express";
import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";

import mockReq from "../../__mocks__/request.mocks";
import {
  mockRedisClientSelector,
  mockSetEx,
} from "../../__mocks__/redis.mocks";
import { getOidcConfiguration } from "../../repositories/oidc-client";
import { reserveEndpoint } from "../oidc";

vi.mock("../../repositories/oidc-client", () => ({
  getOidcConfiguration: vi.fn(),
}));

const mockedGetOidcConfiguration = vi.mocked(getOidcConfiguration);

const AN_ENCODED_JWK =
  "eyJrdHkiOiJFQyIsImNydiI6IlAtMjU2IiwieCI6IjRmMzB6dUdNcm9kRXl3cEoxelZKbWFRLVYtZlM4OVZBTW8yZnN6dWxOTmsiLCJ5IjoibG5NdmExengxaFJncVY5enVEU3dkV0dyUlhTREl4UXQ1YVJVeG1EVW44NCJ9";

const aServerMetadata = {
  authorization_endpoint: "https://localhost/authorize",
};
const anOidcConfiguration = {
  serverMetadata: () => aServerMetadata,
};

const buildReq = (body: Record<string, unknown>) =>
  mockReq({ body }) as unknown as Request;

const deps = {
  redisClientSelector: mockRedisClientSelector,
};

describe("OidcController#reserveEndpoint", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  test("should decode the request and return the reserve response", async () => {
    mockedGetOidcConfiguration.mockResolvedValueOnce(
      anOidcConfiguration as never,
    );
    mockSetEx.mockResolvedValueOnce("OK");

    const req = buildReq({
      env: "PROD",
      min_auth_level: "SpidL2",
      lollipop_pub_key: AN_ENCODED_JWK,
      lollipop_hash_algo: "sha256",
    });

    const result = await pipe({ ...deps, req }, reserveEndpoint, TE.toUnion)();
    expect(result.kind).toEqual("IResponseSuccessJson");
  });

  test("should return IResponseErrorValidation when required params are missing", async () => {
    const req = buildReq({});

    const result = await pipe({ ...deps, req }, reserveEndpoint, TE.toUnion)();

    expect(result.kind).toEqual("IResponseErrorValidation");
    expect(mockedGetOidcConfiguration).not.toHaveBeenCalled();
  });
});
