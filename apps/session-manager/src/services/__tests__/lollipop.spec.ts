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
import { sha256 } from "@pagopa/io-functions-commons/dist/src/utils/crypto";
import {
  activateLolliPoPKey,
  deleteAssertionRefAssociation,
  generateLCParams,
} from "../lollipop";
import {
  aLollipopAssertion,
  anActivatedPubKey,
  anAssertionRef,
  aValidLCParamsResult,
} from "../../__mocks__/lollipop.mocks";
import {
  mockedLollipopApiClient,
  mockGenerateLCParams,
  mockActivatePubKey,
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
import {
  mockTrackEvent,
  mockedAppinsightsTelemetryClient,
} from "../../__mocks__/appinsights.mocks";
import { AssertionTypeEnum } from "../../generated/fast-login-api/AssertionType";

const anOperationId = "operationIdTest" as NonEmptyString;
const anEventName = "anEventName";

const mockedDependencies = { fnLollipopAPIClient: mockedLollipopApiClient };

describe("LollipopService#generateLCParams", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

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
        anEventName,
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
        anEventName,
        "anEventMessage",
      )({
        lollipopRevokeQueueClient: {} as QueueClient,
        redisClientSelector: {} as RedisClientSelectorType,
        appInsightsTelemetryClient: mockedAppinsightsTelemetryClient,
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
    await new Promise((resolve) => setTimeout(() => resolve(""), 10));
    expect(mockTrackEvent).toBeCalledWith({
      name: anEventName + ".delete",
      properties: {
        error: expectedError.message,
        fiscal_code: sha256(aFiscalCode),
        message: "anEventMessage",
      },
    });
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
        anEventName,
        "anEventMessage",
      )({
        lollipopRevokeQueueClient: {} as QueueClient,
        redisClientSelector: {} as RedisClientSelectorType,
        appInsightsTelemetryClient: mockedAppinsightsTelemetryClient,
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
    await new Promise((resolve) => setTimeout(() => resolve(""), 10));
    expect(mockTrackEvent).toBeCalledWith({
      name: anEventName,
      properties: {
        assertion_ref: anAssertionRef,
        error: expectedError,
        fiscal_code: sha256(aFiscalCode),
        message: "error sending revoke message for previous assertionRef",
      },
    });
  });
});

describe("LollipopService#activateLolliPoPKey", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  test(`
  GIVEN lollipop params on user login
  WHEN the lollipop function is reachable and working
  THEN returns an ActivatedPubKey object
  `, async () => {
    mockActivatePubKey.mockResolvedValueOnce(
      E.right({
        status: 200,
        value: anActivatedPubKey,
      }),
    );

    const response = await activateLolliPoPKey({
      ...mockedDependencies,
      assertion: aLollipopAssertion,
      assertionRef: anAssertionRef,
      fiscalCode: aFiscalCode,
      getExpirePubKeyFn: () => new Date(),
      appInsightsTelemetryClient: mockedAppinsightsTelemetryClient,
    })();

    expect(mockTrackEvent).not.toHaveBeenCalled();

    expect(mockActivatePubKey).toBeCalledTimes(1);
    expect(mockActivatePubKey).toBeCalledWith({
      assertion_ref: anAssertionRef,
      body: expect.objectContaining({
        assertion: aLollipopAssertion,
        assertion_type: AssertionTypeEnum.SAML,
        expired_at: expect.any(Date),
        fiscal_code: aFiscalCode,
      }),
    });
    expect(E.isRight(response)).toBeTruthy();
    if (E.isRight(response)) {
      expect(response.right).toEqual(anActivatedPubKey);
    }
  });

  test(`
  GIVEN lollipop params on user login
  WHEN the lollipop function is reachable returns a not success response
  THEN returns an error
  `, async () => {
    mockActivatePubKey.mockResolvedValueOnce(
      E.right({
        status: 400,
        value: "Error",
      }),
    );

    const response = await activateLolliPoPKey({
      ...mockedDependencies,
      assertion: aLollipopAssertion,
      assertionRef: anAssertionRef,
      fiscalCode: aFiscalCode,
      getExpirePubKeyFn: () => new Date(),
      appInsightsTelemetryClient: mockedAppinsightsTelemetryClient,
    })();

    expect(mockTrackEvent).not.toHaveBeenCalled();

    expect(mockActivatePubKey).toBeCalledTimes(1);
    expect(mockActivatePubKey).toBeCalledWith({
      assertion_ref: anAssertionRef,
      body: expect.objectContaining({
        assertion: aLollipopAssertion,
        assertion_type: AssertionTypeEnum.SAML,
        expired_at: expect.any(Date),
        fiscal_code: aFiscalCode,
      }),
    });
    expect(E.isLeft(response)).toBeTruthy();
    if (E.isLeft(response)) {
      expect(response.left).toEqual(
        new Error(
          "Error calling the function lollipop api for pubkey activation",
        ),
      );
    }
  });

  test(`
  GIVEN lollipop params on user login
  WHEN the lollipop function is reachable and the client returns a decoding error
  THEN returns an error
  `, async () => {
    // We use a failed decode to map a generic Validation Errors
    mockActivatePubKey.mockResolvedValueOnce(NonEmptyString.decode(""));
    const response = await activateLolliPoPKey({
      ...mockedDependencies,
      assertion: aLollipopAssertion,
      assertionRef: anAssertionRef,
      fiscalCode: aFiscalCode,
      getExpirePubKeyFn: () => new Date(),
      appInsightsTelemetryClient: mockedAppinsightsTelemetryClient,
    })();

    expect(mockTrackEvent).toHaveBeenCalledTimes(1);
    expect(mockTrackEvent).toHaveBeenCalledWith({
      name: "lollipop.error.acs",
      properties: expect.objectContaining({
        assertion_ref: anAssertionRef,
        fiscal_code: sha256(aFiscalCode),
        message:
          'Error activating lollipop pub key | value [""] at [root] is not a valid [non empty string]',
      }),
    });

    expect(mockActivatePubKey).toBeCalledTimes(1);
    expect(mockActivatePubKey).toBeCalledWith({
      assertion_ref: anAssertionRef,
      body: expect.objectContaining({
        assertion: aLollipopAssertion,
        assertion_type: AssertionTypeEnum.SAML,
        expired_at: expect.any(Date),
        fiscal_code: aFiscalCode,
      }),
    });
    expect(E.isLeft(response)).toBeTruthy();
    if (E.isLeft(response)) {
      expect(response.left).toEqual(expect.any(Error));
    }
  });

  test(`
  GIVEN lollipop params on user login
  WHEN the lollipop function is not reachable
  THEN returns an error
  `, async () => {
    mockActivatePubKey.mockRejectedValueOnce(new Error("Error"));

    const response = await activateLolliPoPKey({
      ...mockedDependencies,
      assertion: aLollipopAssertion,
      assertionRef: anAssertionRef,
      fiscalCode: aFiscalCode,
      getExpirePubKeyFn: () => new Date(),
      appInsightsTelemetryClient: mockedAppinsightsTelemetryClient,
    })();

    expect(mockTrackEvent).toHaveBeenCalledTimes(1);
    expect(mockTrackEvent).toHaveBeenCalledWith({
      name: "lollipop.error.acs",
      properties: expect.objectContaining({
        assertion_ref: anAssertionRef,
        fiscal_code: sha256(aFiscalCode),
        message: "Error activating lollipop pub key | Error",
      }),
    });

    expect(mockActivatePubKey).toBeCalledTimes(1);
    expect(mockActivatePubKey).toBeCalledWith({
      assertion_ref: anAssertionRef,
      body: expect.objectContaining({
        assertion: aLollipopAssertion,
        assertion_type: AssertionTypeEnum.SAML,
        expired_at: expect.any(Date),
        fiscal_code: aFiscalCode,
      }),
    });
    expect(E.isLeft(response)).toBeTruthy();
    if (E.isLeft(response)) {
      expect(response.left).toEqual(new Error("Error"));
    }
  });
});
