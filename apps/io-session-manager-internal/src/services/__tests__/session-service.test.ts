import { beforeEach, describe, expect, it, vi } from "vitest";
import * as E from "fp-ts/lib/Either";
import * as TE from "fp-ts/lib/TaskEither";
import * as H from "@pagopa/handler-kit";
import { FiscalCode } from "@pagopa/ts-commons/lib/strings";
import {
  RedisClientTaskMock,
  RedisRepositoryMock,
  mockUserHasActiveSessionsOrLV,
} from "../../__mocks__/repositories/redis.mock";
import { SessionService } from "../session-service";

const aFiscalCode = "SPNDNL80R13C555X" as FiscalCode;

describe("Session Serviuce", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const deps = {
    FastRedisClientTask: RedisClientTaskMock,
    SafeRedisClientTask: RedisClientTaskMock,
    RedisRepository: RedisRepositoryMock,
  };

  it.each`
    title         | active
    ${"active"}   | ${true}
    ${"inactive"} | ${false}
  `("should succeed with an $title session", async ({ active }) => {
    mockUserHasActiveSessionsOrLV.mockReturnValueOnce(TE.right(active));

    const result = await SessionService.getUserSession(aFiscalCode)(deps)();

    expect(mockUserHasActiveSessionsOrLV).toHaveBeenCalledTimes(1);
    expect(result).toEqual(E.right({ active }));
  });

  it("should error if userHasActiveSessionsOrLV fails", async () => {
    const customError = Error("custom error");
    mockUserHasActiveSessionsOrLV.mockReturnValueOnce(TE.left(customError));
    const result = await SessionService.getUserSession(aFiscalCode)(deps)();

    expect(mockUserHasActiveSessionsOrLV).toHaveBeenCalledTimes(1);
    expect(result).toEqual(E.left(customError));
  });
});
