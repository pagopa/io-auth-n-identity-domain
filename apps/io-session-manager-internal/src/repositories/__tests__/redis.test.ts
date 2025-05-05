import { beforeEach, describe, expect, it, vi } from "vitest";
import * as E from "fp-ts/lib/Either";
import { FiscalCode } from "@pagopa/ts-commons/lib/strings";
import {
  mockGet,
  mockRedisClient,
  mockSmembers,
} from "../../__mocks__/repositories/redis.mock";
import { RedisRepository, userHasActiveSessionsLegacy } from "../redis";
import { LoginTypeEnum } from "../../types/fast-login";
import { AssertionRefSha256 } from "../../generated/internal/AssertionRefSha256";

const aValidUser = {
  session_token: "sessiontoken-abc",
  fiscal_code: "abc" as FiscalCode,
};

const deps = {
  safeClient: mockRedisClient,
  fastClient: mockRedisClient,
  fiscalCode: aValidUser.fiscal_code,
};

describe("Redis repository - userHasActiveSessionsLegacy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return true if exists an active user session", async () => {
    mockSmembers.mockImplementationOnce((_) =>
      Promise.resolve([
        `SESSIONINFO-${aValidUser.session_token}`,
        `SESSIONINFO-expired_session_token`,
      ]),
    );
    mockGet.mockImplementationOnce((_, __) =>
      Promise.resolve(
        JSON.stringify({
          createdAt: new Date(),
          sessionToken: aValidUser.session_token,
        }),
      ),
    );
    mockGet.mockImplementationOnce((_, __) =>
      Promise.resolve(
        JSON.stringify({
          createdAt: new Date(),
          sessionToken: "expired_session_token",
        }),
      ),
    );
    mockGet.mockImplementationOnce((_, __) =>
      Promise.resolve(JSON.stringify(aValidUser)),
    );
    mockGet.mockImplementationOnce((_, __) => Promise.resolve(null));

    const userHasActiveSessionsResult =
      await userHasActiveSessionsLegacy(deps)();

    expect(mockGet).toHaveBeenNthCalledWith(
      3,
      `SESSION-${aValidUser.session_token}`,
    );

    expect(E.isRight(userHasActiveSessionsResult)).toBeTruthy();
    if (E.isRight(userHasActiveSessionsResult)) {
      expect(userHasActiveSessionsResult.right).toEqual(true);
    }
  });

  it("should return false if doens't exists an active user session", async () => {
    mockSmembers.mockImplementationOnce((_) =>
      Promise.resolve([
        `SESSIONINFO-${aValidUser.session_token}`,
        `SESSIONINFO-expired_session_token`,
      ]),
    );

    mockGet.mockImplementationOnce((_, __) =>
      Promise.resolve(
        JSON.stringify({
          createdAt: new Date(),
          sessionToken: aValidUser.session_token,
        }),
      ),
    );
    mockGet.mockImplementationOnce((_, __) =>
      Promise.resolve(
        JSON.stringify({
          createdAt: new Date(),
          sessionToken: "expired_session_token",
        }),
      ),
    );

    mockGet.mockImplementationOnce((_, __) => Promise.resolve(null));
    mockGet.mockImplementationOnce((_, __) => Promise.resolve(null));

    const userHasActiveSessionsResult =
      await userHasActiveSessionsLegacy(deps)();
    expect(E.isRight(userHasActiveSessionsResult)).toBeTruthy();
    if (E.isRight(userHasActiveSessionsResult)) {
      expect(userHasActiveSessionsResult.right).toEqual(false);
    }
  });

  it("should return false if doens't exists any session info for the user", async () => {
    mockSmembers.mockImplementationOnce((_) => Promise.resolve([]));

    const userHasActiveSessionsResult =
      await userHasActiveSessionsLegacy(deps)();
    expect(E.isRight(userHasActiveSessionsResult)).toBeTruthy();
    if (E.isRight(userHasActiveSessionsResult)) {
      expect(userHasActiveSessionsResult.right).toEqual(false);
    }
  });

  it("should return false if sessions info for a user are missing", async () => {
    mockSmembers.mockImplementationOnce((_) =>
      Promise.resolve([
        `SESSIONINFO-${aValidUser.session_token}`,
        `SESSIONINFO-expired_session_token`,
      ]),
    );

    mockGet.mockImplementationOnce((_, __) => Promise.resolve(null));
    mockGet.mockImplementationOnce((_, __) => Promise.resolve(null));

    const userHasActiveSessionsResult =
      await userHasActiveSessionsLegacy(deps)();
    expect(E.isRight(userHasActiveSessionsResult)).toBeTruthy();
    if (E.isRight(userHasActiveSessionsResult)) {
      expect(userHasActiveSessionsResult.right).toEqual(false);
    }
  });

  it("should return a left value if a redis call fail", async () => {
    mockSmembers.mockImplementationOnce((_) =>
      Promise.resolve([
        `SESSIONINFO-${aValidUser.session_token}`,
        `SESSIONINFO-expired_session_token`,
      ]),
    );

    const expectedRedisError = new Error("Generic Redis Error");
    mockGet.mockImplementationOnce((_, __) =>
      Promise.reject(expectedRedisError),
    );

    mockGet.mockImplementationOnce((_, __) =>
      Promise.reject(expectedRedisError),
    );

    const userHasActiveSessionsResult =
      await userHasActiveSessionsLegacy(deps)();

    expect(E.isRight(userHasActiveSessionsResult)).toBeFalsy();
    if (E.isLeft(userHasActiveSessionsResult)) {
      expect(userHasActiveSessionsResult.left).toEqual(expectedRedisError);
    }
  });

  it("should return left value if a redis error occurs searching session info", async () => {
    const expectedRedisError = new Error("Generic Redis Error");

    mockSmembers.mockImplementationOnce((_) =>
      Promise.reject(expectedRedisError),
    );

    const userHasActiveSessionsResult =
      await userHasActiveSessionsLegacy(deps)();
    expect(E.isRight(userHasActiveSessionsResult)).toBeFalsy();
    if (E.isLeft(userHasActiveSessionsResult)) {
      expect(userHasActiveSessionsResult.left).toEqual(expectedRedisError);
    }
  });
});

describe("Redis repository - userHasActiveSessionsOrLV", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const anAssertionRef =
    "sha256-6LvipIvFuhyorHpUqK3HjySC5Y6gshXHFBhU9EJ4DoM=" as AssertionRefSha256;
  const lvLollipopData = { a: anAssertionRef, t: LoginTypeEnum.LV };
  const legacyLollipopData = { a: anAssertionRef, t: LoginTypeEnum.LEGACY };

  const expectedRedisError = new Error("Generic Redis Error");

  const expectOnlyLollipopDataIsRetrieved = (cf: FiscalCode) => {
    expect(mockGet).toHaveBeenNthCalledWith(1, `KEYS-${cf}`);
    expect(mockSmembers).not.toHaveBeenCalled();
    expect(mockGet).toHaveBeenCalledTimes(1);
  };

  const expectLollipopDataAndSessionInfoAreRetrieved = (
    cf: FiscalCode,
    sessionToken: string,
  ) => {
    expect(mockGet).toHaveBeenNthCalledWith(1, `KEYS-${cf}`);
    expect(mockSmembers).toHaveBeenCalledWith(`USERSESSIONS-${cf}`);
    expect(mockGet).toHaveBeenNthCalledWith(2, `SESSIONINFO-${sessionToken}`);
  };

  it("should return true if login type is LV", async () => {
    mockGet.mockImplementationOnce(async (_, __) =>
      JSON.stringify(lvLollipopData),
    );

    const result = await RedisRepository.userHasActiveSessionsOrLV(deps)();
    expect(result).toEqual(E.right(true));

    expectOnlyLollipopDataIsRetrieved(aValidUser.fiscal_code);
  });

  it("should return true if login type is LEGACY and user has an active session", async () => {
    mockGet.mockImplementationOnce(async (_, __) =>
      JSON.stringify(legacyLollipopData),
    );
    mockSmembers.mockImplementationOnce(async (_) => [
      `SESSIONINFO-${aValidUser.session_token}`,
    ]);
    mockGet.mockImplementationOnce(async (_, __) =>
      JSON.stringify({
        createdAt: new Date(),
        sessionToken: aValidUser.session_token,
      }),
    );
    mockGet.mockImplementationOnce(async (_, __) => JSON.stringify(aValidUser));

    const result = await RedisRepository.userHasActiveSessionsOrLV(deps)();
    expect(result).toEqual(E.right(true));

    expectLollipopDataAndSessionInfoAreRetrieved(
      aValidUser.fiscal_code,
      aValidUser.session_token,
    );
  });

  it("should return false if no LollipopData was found", async () => {
    mockGet.mockImplementationOnce(async (_, __) => null);

    const result = await RedisRepository.userHasActiveSessionsOrLV(deps)();
    expect(result).toEqual(E.right(false));

    expectOnlyLollipopDataIsRetrieved(aValidUser.fiscal_code);
  });

  it("should return false if login type is LEGACY, USERSESSION is defined but user has no active sessions", async () => {
    mockGet.mockImplementationOnce(async (_, __) =>
      JSON.stringify({ a: anAssertionRef, t: LoginTypeEnum.LEGACY }),
    );
    mockSmembers.mockImplementationOnce(async (_) => [
      `SESSIONINFO-${aValidUser.session_token}`,
    ]);

    mockGet.mockImplementationOnce(() => Promise.resolve(null));

    const result = await RedisRepository.userHasActiveSessionsOrLV(deps)();
    expect(result).toEqual(E.right(false));

    expectLollipopDataAndSessionInfoAreRetrieved(
      aValidUser.fiscal_code,
      aValidUser.session_token,
    );
  });

  it("should return false if login type is LEGACY and user has no active sessions", async () => {
    mockGet.mockImplementationOnce(async (_, __) =>
      JSON.stringify(legacyLollipopData),
    );
    mockSmembers.mockImplementationOnce(async (_) => []);

    const result = await RedisRepository.userHasActiveSessionsOrLV(deps)();
    expect(result).toEqual(E.right(false));

    expect(mockGet).toHaveBeenNthCalledWith(
      1,
      `KEYS-${aValidUser.fiscal_code}`,
    );
    expect(mockSmembers).toHaveBeenCalledWith(
      `USERSESSIONS-${aValidUser.fiscal_code}`,
    );
    expect(mockGet).toHaveBeenCalledTimes(1);
  });

  it("should return a left value if a redis call fail in getLollipopDataForUser", async () => {
    mockGet.mockImplementationOnce((_, __) =>
      Promise.reject(expectedRedisError),
    );

    const result = await RedisRepository.userHasActiveSessionsOrLV(deps)();
    expect(result).toEqual(E.left(expectedRedisError));
  });

  it("should return a left value if a redis call fail in userHasActiveSessions", async () => {
    mockGet.mockImplementationOnce(async (_, __) =>
      JSON.stringify({ a: anAssertionRef, t: LoginTypeEnum.LEGACY }),
    );

    mockSmembers.mockRejectedValueOnce(expectedRedisError);

    const result = await RedisRepository.userHasActiveSessionsOrLV(deps)();
    expect(result).toEqual(E.left(expectedRedisError));
  });
});
