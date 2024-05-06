import { describe, beforeEach, vi, it, expect, assert } from "vitest";
import { generateNonceEndpoint } from "../fast-login";
import { getFastLoginLollipopConsumerClient } from "../../repositories/fast-login-api";
import * as E from "fp-ts/Either";
import {
  IResponse,
  ResponseErrorInternal,
  ResponseSuccessJson,
} from "@pagopa/ts-commons/lib/responses";
import {
  ResponseErrorStatusNotDefinedInSpec,
  ResponseErrorUnexpectedAuthProblem,
} from "../../utils/responses";
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
} as unknown as ReturnType<getFastLoginLollipopConsumerClient>;

describe("fastLoginController#generateNonce", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const generateNonceController = generateNonceEndpoint({
    client: fastLoginLCClient,
  });

  it("should return the nonce, when the the downstream component returns it", async () => {
    const result = await generateNonceController();

    expectToMatchResult(
      result,
      ResponseSuccessJson(aValidGenerateNonceResponse),
    );
  });

  it.each`
    title                                                                                           | clientResponse                                            | expectedResult
    ${"should return InternalServerError when the client return 401"}                               | ${E.right({ status: 401 })}                               | ${ResponseErrorUnexpectedAuthProblem()}
    ${"should return InternalServerError when the client return 500"}                               | ${E.right({ status: 500, value: { title: "an Error" } })} | ${ResponseErrorInternal(readableProblem({ title: "an Error" }))}
    ${"should return InternalServerError when the client return 502"}                               | ${E.right({ status: 502 })}                               | ${ResponseErrorInternal("An error occurred on upstream service")}
    ${"should return InternalServerError when the client return 504"}                               | ${E.right({ status: 504 })}                               | ${ResponseErrorInternal("An error occurred on upstream service")}
    ${"should return InternalServerError when the client return a status code not defied in specs"} | ${E.right({ status: 418 })}                               | ${ResponseErrorStatusNotDefinedInSpec({ status: 418 } as never)}
  `("$title", async ({ clientResponse, expectedResult }) => {
    mockGenerateNonce.mockResolvedValue(clientResponse);

    const result = await generateNonceController();

    expectToMatchResult(result, expectedResult);
  });
});

// ------------------------
// utilities
// ------------------------

function expectToMatchResult(
  result: E.Either<Error, IResponse<unknown>>,
  expectedResult: IResponse<unknown>,
) {
  assert(E.isRight(result), "Unexpected left either");
  expect(result.right).toMatchObject({
    ...expectedResult,
    apply: expect.any(Function),
  });
}
