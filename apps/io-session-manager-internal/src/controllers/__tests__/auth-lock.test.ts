import { describe, beforeEach, vi, it, expect } from "vitest";
import * as RTE from "fp-ts/ReaderTaskEither";
import * as TE from "fp-ts/lib/TaskEither";
import * as E from "fp-ts/lib/Either";
import { RedisClusterType } from "redis";
import * as H from "@pagopa/handler-kit";
import { makeAuthLockHandler, makeReleaseAuthLockHandler } from "../auth-lock";
import {
  SessionServiceMock,
  mockLockUserAuthentication,
  mockUnlockUserAuthentication,
} from "../../__mocks__/services/session-service.mock";
import { RedisRepository } from "../../repositories/redis";
import { AuthLockRepository } from "../../repositories/auth-lock";
import { mockQueueClient } from "../../__mocks__/queue-client.mock";
import { LollipopRepository } from "../../repositories/lollipop";
import { InstallationRepository } from "../../repositories/installation";
import { mockTableClient } from "../../__mocks__/table-client.mock";
import { httpHandlerInputMocks } from "../__mocks__/handler.mock";
import { UnlockCode } from "../../generated/definitions/internal/UnlockCode";
import {
  forbiddenError,
  toConflictError,
  toGenericError,
} from "../../utils/errors";

const aFiscalCode = "SPNDNL80R13C555X";

const mockedDependencies = {
  SessionService: SessionServiceMock,
  // service is already mocked, no need to mock the repositories
  RedisRepository: {} as RedisRepository,
  SafeRedisClientTask: TE.of({} as RedisClusterType),
  FastRedisClientTask: TE.of({} as RedisClusterType),
  AuthLockRepository: {} as AuthLockRepository,
  AuthenticationLockTableClient: mockTableClient,
  LollipopRepository: {} as LollipopRepository,
  RevokeAssertionRefQueueClient: mockQueueClient,
  InstallationRepository: {} as InstallationRepository,
  NotificationQueueClient: mockQueueClient,
};
describe("Auth Lock Handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const aValidUnlockCode = "000000000" as UnlockCode;
  const aValidPayload = {
    unlock_code: aValidUnlockCode,
  };

  it("should succeed locking the authentication of a user", async () => {
    const req = {
      ...H.request("mockUrl"),
      path: {
        fiscalCode: aFiscalCode,
      },
      body: aValidPayload,
    };
    const result = await makeAuthLockHandler({
      ...httpHandlerInputMocks,
      input: req,
      ...mockedDependencies,
    })();

    expect(result).toMatchObject(E.right(H.empty));
  });

  it.each`
    scenario     | value
    ${"missing"} | ${undefined}
    ${"empty"}   | ${null}
    ${"invalid"} | ${{ unlock_code: "abc" }}
  `("should return Bad request on $scenario body", async ({ value }) => {
    const req = {
      ...H.request("mockUrl"),
      path: {
        fiscalCode: aFiscalCode,
      },
      body: value,
    };

    const result = await makeAuthLockHandler({
      ...httpHandlerInputMocks,
      input: req,
      ...mockedDependencies,
    })();

    expect(result).toMatchObject(
      E.right({ body: { status: 400, title: "Missing or invalid body" } }),
    );
  });

  it("should return Bad request on invalid path param", async () => {
    const req = {
      ...H.request("mockUrl"),
      path: {
        fiscalCode: "abc",
      },
      body: aValidPayload,
    };

    const result = await makeAuthLockHandler({
      ...httpHandlerInputMocks,
      input: req,
      ...mockedDependencies,
    })();

    expect(result).toMatchObject(
      E.right({
        body: { status: 400, title: `Invalid "fiscalCode" supplied` },
      }),
    );
  });

  it("should return Error internal coherent with service response", async () => {
    const req = {
      ...H.request("mockUrl"),
      path: {
        fiscalCode: aFiscalCode,
      },
      body: aValidPayload,
    };
    mockLockUserAuthentication.mockReturnValueOnce(
      RTE.left(toGenericError("ERROR")),
    );

    const result = await makeAuthLockHandler({
      ...httpHandlerInputMocks,
      input: req,
      ...mockedDependencies,
    })();

    expect(mockLockUserAuthentication).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject(
      E.right({ body: { status: 500, title: "ERROR" } }),
    );
  });

  it("should return Conflict error coherent with service response", async () => {
    const req = {
      ...H.request("mockUrl"),
      path: {
        fiscalCode: aFiscalCode,
      },
      body: aValidPayload,
    };
    mockLockUserAuthentication.mockReturnValueOnce(
      RTE.left(toConflictError("ERROR")),
    );

    const result = await makeAuthLockHandler({
      ...httpHandlerInputMocks,
      input: req,
      ...mockedDependencies,
    })();

    expect(mockLockUserAuthentication).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject(
      E.right({ body: { status: 409, title: "ERROR" } }),
    );
  });
});

describe("Release Auth Lock Handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should succeed releasing a user authentication lock", async () => {
    const req = {
      ...H.request("mockUrl"),
      path: {
        fiscalCode: aFiscalCode,
      },
      body: {},
    };
    const result = await makeReleaseAuthLockHandler({
      ...httpHandlerInputMocks,
      input: req,
      ...mockedDependencies,
    })();

    expect(mockUnlockUserAuthentication).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject(E.right(H.empty));
  });

  it("should fail on invalid request", async () => {
    const req = {
      ...H.request("mockUrl"),
      path: {
        fiscalCode: "invalid",
      },
    };
    const result = await makeReleaseAuthLockHandler({
      ...httpHandlerInputMocks,
      input: req,
      ...mockedDependencies,
    })();

    expect(result).toMatchObject(E.right({ body: { status: 400 } }));
  });

  it.each`
    scenario       | value                      | status
    ${"generic"}   | ${toGenericError("ERROR")} | ${500}
    ${"forbidden"} | ${forbiddenError}          | ${403}
  `("should fail on service $scenario error", async ({ value, status }) => {
    const req = {
      ...H.request("mockUrl"),
      path: {
        fiscalCode: aFiscalCode,
      },
      body: {},
    };

    mockUnlockUserAuthentication.mockReturnValueOnce(RTE.left(value));
    const result = await makeReleaseAuthLockHandler({
      ...httpHandlerInputMocks,
      input: req,
      ...mockedDependencies,
    })();

    expect(result).toMatchObject(E.right({ body: { status } }));
  });
});
