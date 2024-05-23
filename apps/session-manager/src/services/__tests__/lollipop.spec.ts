import {
  describe,
  test,
  expect,
  vi,
  afterEach,
  afterAll,
  beforeEach,
} from "vitest";

import { pipe } from "fp-ts/lib/function";
import * as E from "fp-ts/Either";
import * as TE from "fp-ts/TaskEither";

import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";

import { QueueClient } from "@azure/storage-queue";
import { deleteAssertionRefAssociation, generateLCParams } from "../lollipop";
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
import { RedisSessionStorageService } from "..";
import { LollipopRevokeRepo } from "../../repositories";
import { aFiscalCode } from "../../__mocks__/user.mocks";
import { RedisClientSelectorType } from "../../types/redis";

const anOperationId = "operationIdTest" as NonEmptyString;

describe("LollipopService#generateLCParams", () => {
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

describe("LollipopService#deleteAssertionRefAssociation", () => {
  const mockRevokePreviousAssertionRef = vi
    .spyOn(LollipopRevokeRepo, "revokePreviousAssertionRef")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .mockImplementation(() => () => TE.of({} as any));
  const mockDelLollipopDataForUser = vi
    .spyOn(RedisSessionStorageService, "delLollipopDataForUser")
    .mockImplementation(() => TE.of<Error, boolean>(true));

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });
  test("should return success if all the Lollipop data are removed successfully", async () => {
    const result = await pipe(
      deleteAssertionRefAssociation(
        aFiscalCode,
        anAssertionRef,
        "anEventName",
        "anEventMessage",
      )({
        lollipopRevokeQueueClient: {} as QueueClient,
        redisClientSelector: {} as RedisClientSelectorType,
      }),
      TE.map((value) => {
        expect(value).toEqual(true);
      }),
    )();

    expect(mockRevokePreviousAssertionRef).toBeCalledWith(anAssertionRef);
    expect(mockDelLollipopDataForUser).toBeCalledWith(
      expect.objectContaining({ fiscalCode: aFiscalCode }),
    );
    expect(E.isRight(result)).toBeTruthy();
  });

  test("should return an error if delLollipopDataForUser fail", async () => {
    const expectedError = new Error("an Error");
    mockDelLollipopDataForUser.mockImplementationOnce(() =>
      TE.left(expectedError),
    );
    const result = await pipe(
      deleteAssertionRefAssociation(
        aFiscalCode,
        anAssertionRef,
        "anEventName",
        "anEventMessage",
      )({
        lollipopRevokeQueueClient: {} as QueueClient,
        redisClientSelector: {} as RedisClientSelectorType,
      }),
      TE.mapLeft((value) => {
        expect(value).toEqual(expectedError);
      }),
    )();

    expect(mockRevokePreviousAssertionRef).toBeCalledWith(anAssertionRef);
    expect(mockDelLollipopDataForUser).toBeCalledWith(
      expect.objectContaining({ fiscalCode: aFiscalCode }),
    );
    expect(E.isLeft(result)).toBeTruthy();
  });

  test("should success if fire and forget revokePreviousAssertionRef fails", async () => {
    const expectedError = new Error("an Error");
    mockRevokePreviousAssertionRef.mockImplementationOnce(
      () => () => TE.left(expectedError),
    );
    const result = await pipe(
      deleteAssertionRefAssociation(
        aFiscalCode,
        anAssertionRef,
        "anEventName",
        "anEventMessage",
      )({
        lollipopRevokeQueueClient: {} as QueueClient,
        redisClientSelector: {} as RedisClientSelectorType,
      }),
      TE.map((value) => {
        expect(value).toEqual(true);
      }),
    )();

    expect(mockRevokePreviousAssertionRef).toBeCalledWith(anAssertionRef);
    expect(mockDelLollipopDataForUser).toBeCalledWith(
      expect.objectContaining({ fiscalCode: aFiscalCode }),
    );
    expect(E.isRight(result)).toBeTruthy();
  });
});
