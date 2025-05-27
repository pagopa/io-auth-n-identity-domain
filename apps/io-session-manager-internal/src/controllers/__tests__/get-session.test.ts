import { beforeEach, describe, expect, it, vi } from "vitest";
import * as E from "fp-ts/lib/Either";
import * as TE from "fp-ts/lib/TaskEither";
import * as RTE from "fp-ts/lib/ReaderTaskEither";
import * as H from "@pagopa/handler-kit";
import { RedisClusterType } from "redis";
import { TableClient } from "@azure/data-tables";
import { httpHandlerInputMocks } from "../__mocks__/handler.mock";
import {
  makeGetSessionHandler,
  makeGetSessionStateHandler,
} from "../get-session";
import {
  SessionServiceMock,
  mockGetUserSession,
  mockGetUserSessionState,
} from "../../__mocks__/services/session-service.mock";
import { RedisRepository } from "../../repositories/redis";
import { AuthLockRepository } from "../../repositories/auth-lock";
import { anUnlockedUserSessionState } from "../../__mocks__/user.mock";
import { toGenericError } from "../../utils/errors";

const aFiscalCode = "SPNDNL80R13C555X";

describe("GetSession handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should succeed if a session is found", async () => {
    const req = {
      ...H.request("mockUrl"),
      path: {
        fiscalCode: aFiscalCode,
      },
    };

    const result = await makeGetSessionHandler({
      ...httpHandlerInputMocks,
      input: req,
      SessionService: SessionServiceMock,
      // service is already mocked, no need to mock the repositories
      RedisRepository: {} as RedisRepository,
      SafeRedisClientTask: TE.of({} as RedisClusterType),
      FastRedisClientTask: TE.of({} as RedisClusterType),
    })();

    expect(mockGetUserSession).toHaveBeenCalledTimes(1);

    expect(result).toEqual(E.right(H.successJson({ active: true })));
  });

  it("should fail on invalid fiscal code", async () => {
    const req = {
      ...H.request("mockUrl"),
      path: {
        fiscalCode: "abcd",
      },
    };

    const result = await makeGetSessionHandler({
      ...httpHandlerInputMocks,
      input: req,
      SessionService: SessionServiceMock,
      // service is already mocked, no need to mock the repositories
      RedisRepository: {} as RedisRepository,
      SafeRedisClientTask: TE.of({} as RedisClusterType),
      FastRedisClientTask: TE.of({} as RedisClusterType),
    })();

    expect(mockGetUserSession).toHaveBeenCalledTimes(0);

    expect(result).toMatchObject(E.right({ body: { status: 400 } }));
  });

  it("should fail if SessionService fails", async () => {
    const req = {
      ...H.request("mockUrl"),
      path: {
        fiscalCode: aFiscalCode,
      },
    };

    mockGetUserSession.mockReturnValueOnce(RTE.left(new H.HttpError()));

    const result = await makeGetSessionHandler({
      ...httpHandlerInputMocks,
      input: req,
      SessionService: SessionServiceMock,
      // service is already mocked, no need to mock the repositories
      RedisRepository: {} as RedisRepository,
      SafeRedisClientTask: TE.of({} as RedisClusterType),
      FastRedisClientTask: TE.of({} as RedisClusterType),
    })();

    expect(mockGetUserSession).toHaveBeenCalledTimes(1);

    expect(result).toMatchObject(E.right({ body: { status: 500 } }));
  });
});

describe("GetSessionState handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should succeed for an unlocked user", async () => {
    const req = {
      ...H.request("mockUrl"),
      path: {
        fiscalCode: aFiscalCode,
      },
    };

    const result = await makeGetSessionStateHandler({
      ...httpHandlerInputMocks,
      input: req,
      SessionService: SessionServiceMock,
      // service is already mocked, no need to mock the repositories
      RedisRepository: {} as RedisRepository,
      AuthLockRepository: {} as AuthLockRepository,
      SafeRedisClientTask: TE.of({} as RedisClusterType),
      AuthenticationLockTableClient: {} as TableClient,
    })();

    expect(mockGetUserSessionState).toHaveBeenCalledTimes(1);

    expect(result).toEqual(E.right(H.successJson(anUnlockedUserSessionState)));
  });

  it("should fail on invalid path param", async () => {
    const req = {
      ...H.request("mockUrl"),
      path: {
        fiscalCode: "",
      },
    };

    const result = await makeGetSessionStateHandler({
      ...httpHandlerInputMocks,
      input: req,
      SessionService: SessionServiceMock,
      // service is already mocked, no need to mock the repositories
      RedisRepository: {} as RedisRepository,
      AuthLockRepository: {} as AuthLockRepository,
      SafeRedisClientTask: TE.of({} as RedisClusterType),
      AuthenticationLockTableClient: {} as TableClient,
    })();

    expect(mockGetUserSessionState).not.toHaveBeenCalled();

    expect(result).toMatchObject(E.right({ body: { status: 400 } }));
  });

  it("should fail on service failure", async () => {
    const req = {
      ...H.request("mockUrl"),
      path: {
        fiscalCode: aFiscalCode,
      },
    };

    const anError = toGenericError("ERROR");

    mockGetUserSessionState.mockReturnValueOnce(RTE.left(anError));

    const result = await makeGetSessionStateHandler({
      ...httpHandlerInputMocks,
      input: req,
      SessionService: SessionServiceMock,
      // service is already mocked, no need to mock the repositories
      RedisRepository: {} as RedisRepository,
      AuthLockRepository: {} as AuthLockRepository,
      SafeRedisClientTask: TE.of({} as RedisClusterType),
      AuthenticationLockTableClient: {} as TableClient,
    })();

    expect(mockGetUserSessionState).toHaveBeenCalledTimes(1);

    expect(result).toMatchObject(
      E.right({ body: { status: 500, title: anError.causedBy?.message } }),
    );
  });
});
