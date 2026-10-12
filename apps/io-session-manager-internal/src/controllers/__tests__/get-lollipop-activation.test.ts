import { describe, beforeEach, vi, it, expect } from "vitest";
import * as RTE from "fp-ts/ReaderTaskEither";
import * as TE from "fp-ts/lib/TaskEither";
import * as E from "fp-ts/lib/Either";
import { RedisClusterType } from "redis";
import * as H from "@pagopa/handler-kit";
import { makeGetUserLollipopActivationHandler } from "../get-lollipop-activation";
import {
  SessionServiceMock,
  mockGetUserLollipopActivation,
} from "../../__mocks__/services/session-service.mock";
import { RedisRepository } from "../../repositories/redis";
import { httpHandlerInputMocks } from "../__mocks__/handler.mock";
import { toGenericError, toNotFoundError } from "../../utils/errors";
import { anAssertionRef } from "../../__mocks__/user.mock";

const aFiscalCode = "SPNDNL80R13C555X";

const mockedDependencies = {
  SessionService: SessionServiceMock,
  // service is already mocked, no need to mock the repositories
  RedisRepository: {} as RedisRepository,
  SafeRedisClientTask: TE.of({} as RedisClusterType),
};

describe("Get User Lollipop Activation Handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should succeed returning the user lollipop assertion ref", async () => {
    const req = {
      ...H.request("mockUrl"),
      path: {
        fiscalCode: aFiscalCode,
      },
    };
    const result = await makeGetUserLollipopActivationHandler({
      ...httpHandlerInputMocks,
      input: req,
      ...mockedDependencies,
    })();

    expect(mockGetUserLollipopActivation).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject(
      E.right(H.successJson({ assertion_ref: anAssertionRef })),
    );
  });

  it("should return Bad request on invalid path param", async () => {
    const req = {
      ...H.request("mockUrl"),
      path: {
        fiscalCode: "invalid",
      },
    };
    const result = await makeGetUserLollipopActivationHandler({
      ...httpHandlerInputMocks,
      input: req,
      ...mockedDependencies,
    })();

    expect(result).toMatchObject(E.right({ body: { status: 400 } }));
  });

  it("should return 404 when the lollipop activation is not found", async () => {
    const req = {
      ...H.request("mockUrl"),
      path: {
        fiscalCode: aFiscalCode,
      },
    };
    mockGetUserLollipopActivation.mockReturnValueOnce(
      RTE.left(toNotFoundError("LollipopActivation")),
    );
    const result = await makeGetUserLollipopActivationHandler({
      ...httpHandlerInputMocks,
      input: req,
      ...mockedDependencies,
    })();

    expect(result).toMatchObject(E.right({ body: { status: 404 } }));
  });

  it("should fail on service generic error", async () => {
    const req = {
      ...H.request("mockUrl"),
      path: {
        fiscalCode: aFiscalCode,
      },
    };

    const anError = toGenericError("ERROR");
    mockGetUserLollipopActivation.mockReturnValueOnce(RTE.left(anError));
    const result = await makeGetUserLollipopActivationHandler({
      ...httpHandlerInputMocks,
      input: req,
      ...mockedDependencies,
    })();

    expect(result).toMatchObject(
      E.right({ body: { status: 500, title: anError.causedBy?.message } }),
    );
  });
});
