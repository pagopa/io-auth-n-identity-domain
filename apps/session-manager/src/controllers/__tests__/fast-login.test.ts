import { describe, beforeEach, vi, it, expect } from "vitest";
import * as E from "fp-ts/Either";
import { ResponseSuccessJson } from "@pagopa/ts-commons/lib/responses";
import { generateNonceEndpoint } from "../fast-login";
import { getFnFastLoginAPIClient } from "../../repositories/fast-login-api";
import { readableProblem } from "../../utils/errors";

const aValidGenerateNonceResponse = {
  nonce: "870c6d89-a3c4-48b1-a796-cdacddaf94b4",
};
const mockGenerateNonce = vi
  .fn()
  .mockResolvedValue(
    E.right({ status: 200, value: aValidGenerateNonceResponse }),
  );

const fastLoginLCClient = {
  generateNonce: mockGenerateNonce,
} as unknown as ReturnType<getFnFastLoginAPIClient>;

describe("fastLoginController#generateNonce", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const generateNonceController = generateNonceEndpoint({
    fnFastLoginAPIClient: fastLoginLCClient,
  });

  it("should return the nonce, when the the downstream component returns it", async () => {
    const result = await generateNonceController();
    const expectedResult = ResponseSuccessJson(aValidGenerateNonceResponse);

    expect(mockGenerateNonce).toHaveBeenCalled();
    expect(result).toEqual(
      E.right({
        ...expectedResult,
        apply: expect.any(Function),
      }),
    );
  });

  it.each`
    title                                                             | clientResponse                                            | expectedResult
    ${"should return InternalServerError when the client return 401"} | ${E.right({ status: 401 })}                               | ${Error("Underlying API fails with an unexpected 401")}
    ${"should return InternalServerError when the client return 500"} | ${E.right({ status: 500, value: { title: "an Error" } })} | ${Error(readableProblem({ detail: "an Error" }))}
    ${"should return InternalServerError when the client return 502"} | ${E.right({ status: 502 })}                               | ${Error("An error occurred on upstream service")}
    ${"should return InternalServerError when the client return 504"} | ${E.right({ status: 504 })}                               | ${Error("An error occurred on upstream service")}
  `("$title", async ({ clientResponse, expectedResult }) => {
    mockGenerateNonce.mockResolvedValue(clientResponse);

    const result = await generateNonceController();

    expect(mockGenerateNonce).toHaveBeenCalled();
    expect(result).toEqual(E.left(Error(expectedResult.message)));
  });
});
