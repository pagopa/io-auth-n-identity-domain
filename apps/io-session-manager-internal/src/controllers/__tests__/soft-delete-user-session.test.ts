import { describe, beforeEach, vi, it, expect } from "vitest";
import * as RTE from "fp-ts/ReaderTaskEither";
import * as TE from "fp-ts/lib/TaskEither";
import * as E from "fp-ts/lib/Either";
import { RedisClusterType } from "redis";
import * as H from "@pagopa/handler-kit";
import { makeSoftDeleteUserSessionHandler } from "../soft-delete-user-session";
import {
  SessionServiceMock,
  mockSoftDeleteUserSession,
} from "../../__mocks__/services/session-service.mock";
import { RedisRepository } from "../../repositories/redis";
import { mockQueueClient } from "../../__mocks__/queue-client.mock";
import { LollipopRepository } from "../../repositories/lollipop";
import { httpHandlerInputMocks } from "../__mocks__/handler.mock";
import { toGenericError } from "../../utils/errors";
import { PlatformInternalApiClient } from "../../utils/platform-internal-client";
import { PlatformInternalRepository } from "../../repositories/platform-internal";

const aFiscalCode = "SPNDNL80R13C555X";

const mockedDependencies = {
  SessionService: SessionServiceMock,
  // service is already mocked, no need to mock the repositories
  RedisRepository: {} as RedisRepository,
  FastRedisClientTask: TE.of({} as RedisClusterType),
  SafeRedisClientTask: TE.of({} as RedisClusterType),
  LollipopRepository: {} as LollipopRepository,
  RevokeAssertionRefQueueClient: mockQueueClient,
  platformInternalApiClient: {} as PlatformInternalApiClient,
  PlatformInternalRepository: {} as PlatformInternalRepository,
};

describe("Soft Delete User Session Handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should succeed soft-deleting a user session", async () => {
    const req = {
      ...H.request("mockUrl"),
      path: {
        fiscalCode: aFiscalCode,
      },
    };
    const result = await makeSoftDeleteUserSessionHandler({
      ...httpHandlerInputMocks,
      input: req,
      ...mockedDependencies,
    })();

    expect(mockSoftDeleteUserSession).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject(E.right(H.success(null)));
  });

  it("should return Bad request on invalid path param", async () => {
    const req = {
      ...H.request("mockUrl"),
      path: {
        fiscalCode: "invalid",
      },
    };
    const result = await makeSoftDeleteUserSessionHandler({
      ...httpHandlerInputMocks,
      input: req,
      ...mockedDependencies,
    })();

    expect(result).toMatchObject(E.right({ body: { status: 400 } }));
  });

  it("should fail on service generic error", async () => {
    const req = {
      ...H.request("mockUrl"),
      path: {
        fiscalCode: aFiscalCode,
      },
    };

    const anError = toGenericError("ERROR");
    mockSoftDeleteUserSession.mockReturnValueOnce(RTE.left(anError));
    const result = await makeSoftDeleteUserSessionHandler({
      ...httpHandlerInputMocks,
      input: req,
      ...mockedDependencies,
    })();

    expect(result).toMatchObject(
      E.right({ body: { status: 500, title: anError.causedBy?.message } }),
    );
  });
});
