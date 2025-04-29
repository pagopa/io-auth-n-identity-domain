import { beforeEach, describe, expect, it, vi } from "vitest";
import * as E from "fp-ts/lib/Either";
import * as TE from "fp-ts/lib/TaskEither";
import * as RTE from "fp-ts/lib/ReaderTaskEither";
import * as H from "@pagopa/handler-kit";
import { RedisClientType } from "redis";
import { httpHandlerInputMocks } from "../__mocks__/handler.mock";
import { makeGetSessionHandler } from "../get-session";
import {
  SessionServiceMock,
  mockGetUserSession,
} from "../../__mocks__/services/session-service.mock";
import { RedisRepository } from "../../repositories/redis";

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
      RedisClientTask: TE.of({} as RedisClientType),
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
      RedisClientTask: TE.of({} as RedisClientType),
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
      RedisClientTask: TE.of({} as RedisClientType),
    })();

    expect(mockGetUserSession).toHaveBeenCalledTimes(1);

    expect(result).toMatchObject(E.right({ body: { status: 500 } }));
  });
});
