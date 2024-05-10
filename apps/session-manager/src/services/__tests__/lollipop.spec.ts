import { describe, test, expect, vi, afterEach } from "vitest";

import { pipe } from "fp-ts/lib/function";
import * as E from "fp-ts/Either";

import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";

import { generateLCParams } from "../lollipop";
import {
  anAssertionRef,
  aValidLCParamsResult,
} from "../../__mocks__/lollipop.mocks";
import {
  mockedLollipopApiClient,
  mockGenerateLCParams,
} from "../../__mocks__/repositories/lollipop-api.mocks";
import {
  DomainErrorTypes,
  toGenericError,
  toNotFoundError,
  unauthorizedError,
} from "../../models/domain-errors";

const anOperationId = "operationIdTest" as NonEmptyString;

describe("generateLCParams", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  const mockedDependencies = { lollipopApiClient: mockedLollipopApiClient };

  test("should return an LCParam object, when all dependencies are ok", async () => {
    const result = await pipe(
      mockedDependencies,
      generateLCParams(anAssertionRef, anOperationId),
    )();

    expect(result).toEqual(E.right(aValidLCParamsResult));
    expect(mockGenerateLCParams).toHaveBeenCalledWith({
      assertion_ref: anAssertionRef,
      body: {
        operation_id: anOperationId,
      },
    });
  });

  test.each`
    scenario                                          | response                    | expectedError
    ${"the lollipop client return a 403 status code"} | ${E.right({ status: 403 })} | ${unauthorizedError}
    ${"the lollipop client return a 404 status code"} | ${E.right({ status: 404 })} | ${toNotFoundError("LcParams")}
    ${"the lollipop client return a 400 status code"} | ${E.right({ status: 400 })} | ${toGenericError("An error occurred on upstream service")}
    ${"the lollipop client return a 500 status code"} | ${E.right({ status: 500 })} | ${toGenericError("An error occurred on upstream service")}
  `(
    "should return $expectedError.kind error, when $scenario",
    async ({ response, expectedError }) => {
      mockGenerateLCParams.mockResolvedValueOnce(response);

      const result = await pipe(
        mockedDependencies,
        generateLCParams(anAssertionRef, anOperationId),
      )();

      expect(result).toEqual(E.left(expectedError));
    },
  );

  test("should return a GENERIC_ERROR error, when the lollipop client fails decoding the response", async () => {
    mockGenerateLCParams.mockResolvedValueOnce(NonEmptyString.decode(""));

    const result = await pipe(
      mockedDependencies,
      generateLCParams(anAssertionRef, anOperationId),
    )();

    expect(result).toEqual(
      E.left({
        kind: DomainErrorTypes.GENERIC_ERROR,
        causedBy: expect.objectContaining({
          message: expect.stringContaining(
            "Unexpected response from lollipop service:",
          ),
        }),
      }),
    );
  });

  test("should return a GENERIC_ERROR error, when something went wrong calling lollipop api", async () => {
    mockGenerateLCParams.mockRejectedValueOnce(Error("an Error"));

    const result = await pipe(
      mockedDependencies,
      generateLCParams(anAssertionRef, anOperationId),
    )();

    expect(result).toEqual(
      E.left({
        kind: DomainErrorTypes.GENERIC_ERROR,
        causedBy: expect.objectContaining({
          message: expect.stringMatching(
            "Error calling the Lollipop function service",
          ),
        }),
      }),
    );
  });
});
