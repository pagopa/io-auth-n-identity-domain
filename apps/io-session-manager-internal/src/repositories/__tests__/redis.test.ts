import { beforeEach, describe, expect, it, vi } from "vitest";
import * as E from "fp-ts/lib/Either";
import * as O from "fp-ts/lib/Option";
import { FiscalCode } from "@pagopa/ts-commons/lib/strings";
import {
  mockDel,
  mockGet,
  mockRedisClient,
  mockSmembers,
  mockSrem,
} from "../../__mocks__/repositories/redis.mock";
import { RedisRepository, userHasActiveSessionsLegacy } from "../redis";
import { LoginTypeEnum } from "../../types/fast-login";
import { AssertionRefSha256 } from "../../generated/internal/AssertionRefSha256";
import {
  anAssertionRef,
  anUser,
  mockSessionToken,
} from "../../__mocks__/user.mock";

const deps = {
  safeClient: mockRedisClient,
  fastClient: mockRedisClient,
  fiscalCode: anUser.fiscal_code,
};

describe("Redis repository - userHasActiveSessionsLegacy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return true if exists an active user session", async () => {
    mockSmembers.mockImplementationOnce((_) =>
      Promise.resolve([
        `SESSIONINFO-${anUser.session_token}`,
        `SESSIONINFO-expired_session_token`,
      ]),
    );
    mockGet.mockImplementationOnce((_, __) =>
      Promise.resolve(
        JSON.stringify({
          createdAt: new Date(),
          sessionToken: anUser.session_token,
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
      Promise.resolve(JSON.stringify(anUser)),
    );
    mockGet.mockImplementationOnce((_, __) => Promise.resolve(null));

    const userHasActiveSessionsResult =
      await userHasActiveSessionsLegacy(deps)();

    expect(mockGet).toHaveBeenNthCalledWith(
      3,
      `SESSION-${anUser.session_token}`,
    );

    expect(E.isRight(userHasActiveSessionsResult)).toBeTruthy();
    if (E.isRight(userHasActiveSessionsResult)) {
      expect(userHasActiveSessionsResult.right).toEqual(true);
    }
  });

  it("should return false if doens't exists an active user session", async () => {
    mockSmembers.mockImplementationOnce((_) =>
      Promise.resolve([
        `SESSIONINFO-${anUser.session_token}`,
        `SESSIONINFO-expired_session_token`,
      ]),
    );

    mockGet.mockImplementationOnce((_, __) =>
      Promise.resolve(
        JSON.stringify({
          createdAt: new Date(),
          sessionToken: anUser.session_token,
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
        `SESSIONINFO-${anUser.session_token}`,
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
        `SESSIONINFO-${anUser.session_token}`,
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

    expectOnlyLollipopDataIsRetrieved(anUser.fiscal_code);
  });

  it("should return true if login type is LEGACY and user has an active session", async () => {
    mockGet.mockImplementationOnce(async (_, __) =>
      JSON.stringify(legacyLollipopData),
    );
    mockSmembers.mockImplementationOnce(async (_) => [
      `SESSIONINFO-${anUser.session_token}`,
    ]);
    mockGet.mockImplementationOnce(async (_, __) =>
      JSON.stringify({
        createdAt: new Date(),
        sessionToken: anUser.session_token,
      }),
    );
    mockGet.mockImplementationOnce(async (_, __) => JSON.stringify(anUser));

    const result = await RedisRepository.userHasActiveSessionsOrLV(deps)();
    expect(result).toEqual(E.right(true));

    expectLollipopDataAndSessionInfoAreRetrieved(
      anUser.fiscal_code,
      anUser.session_token,
    );
  });

  it("should return false if no LollipopData was found", async () => {
    mockGet.mockImplementationOnce(async (_, __) => null);

    const result = await RedisRepository.userHasActiveSessionsOrLV(deps)();
    expect(result).toEqual(E.right(false));

    expectOnlyLollipopDataIsRetrieved(anUser.fiscal_code);
  });

  it("should return false if login type is LEGACY, USERSESSION is defined but user has no active sessions", async () => {
    mockGet.mockImplementationOnce(async (_, __) =>
      JSON.stringify({ a: anAssertionRef, t: LoginTypeEnum.LEGACY }),
    );
    mockSmembers.mockImplementationOnce(async (_) => [
      `SESSIONINFO-${anUser.session_token}`,
    ]);

    mockGet.mockImplementationOnce(() => Promise.resolve(null));

    const result = await RedisRepository.userHasActiveSessionsOrLV(deps)();
    expect(result).toEqual(E.right(false));

    expectLollipopDataAndSessionInfoAreRetrieved(
      anUser.fiscal_code,
      anUser.session_token,
    );
  });

  it("should return false if login type is LEGACY and user has no active sessions", async () => {
    mockGet.mockImplementationOnce(async (_, __) =>
      JSON.stringify(legacyLollipopData),
    );
    mockSmembers.mockImplementationOnce(async (_) => []);

    const result = await RedisRepository.userHasActiveSessionsOrLV(deps)();
    expect(result).toEqual(E.right(false));

    expect(mockGet).toHaveBeenNthCalledWith(1, `KEYS-${anUser.fiscal_code}`);
    expect(mockSmembers).toHaveBeenCalledWith(
      `USERSESSIONS-${anUser.fiscal_code}`,
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

describe("Redis repository#getLollipopAssertionRefForUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should success and return an assertionRef", async () => {
    mockGet.mockImplementationOnce((_) => Promise.resolve(anAssertionRef));
    const result = await RedisRepository.getLollipopAssertionRefForUser(deps)();

    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockGet).toBeCalledWith(`KEYS-${anUser.fiscal_code}`);
    expect(result).toEqual(E.right(O.some(anAssertionRef)));
  });

  it("should success and return an assertionRef, if data is stored in new format", async () => {
    mockGet.mockImplementationOnce((_) =>
      Promise.resolve(
        JSON.stringify({ a: anAssertionRef, t: LoginTypeEnum.LEGACY }),
      ),
    );
    const result = await RedisRepository.getLollipopAssertionRefForUser(deps)();

    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockGet).toBeCalledWith(`KEYS-${anUser.fiscal_code}`);
    expect(result).toEqual(E.right(O.some(anAssertionRef)));
  });

  it("should success and return none if assertionRef is missing", async () => {
    mockGet.mockImplementationOnce((_) => Promise.resolve(null));
    const result = await RedisRepository.getLollipopAssertionRefForUser(deps)();

    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockGet).toBeCalledWith(`KEYS-${anUser.fiscal_code}`);
    expect(result).toEqual(E.right(O.none));
  });

  it("should fail with a left response if an error occurs on redis", async () => {
    const expectedError = new Error("redis Error");
    mockGet.mockImplementationOnce((_) => Promise.reject(expectedError));
    const result = await RedisRepository.getLollipopAssertionRefForUser(deps)();

    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockGet).toBeCalledWith(`KEYS-${anUser.fiscal_code}`);
    expect(result).toEqual(E.left(expectedError));
  });

  it("should fail with a left response if the value stored is invalid", async () => {
    mockGet.mockImplementationOnce((_) => Promise.resolve("an invalid value"));
    const result = await RedisRepository.getLollipopAssertionRefForUser(deps)();

    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockGet).toBeCalledWith(`KEYS-${anUser.fiscal_code}`);
    expect(result).toMatchObject({
      left: {
        message: expect.stringContaining("is not a valid"),
      },
    });
  });
});

describe("RedisSessionStorage#delLollipopDataForUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should success and return true if one element if removed", async () => {
    mockDel.mockResolvedValueOnce(1);
    const result = await RedisRepository.delLollipopDataForUser(deps)();

    expect(result).toEqual(E.right(true));
  });

  it("should return an error if delete rise an error", async () => {
    const expectedError = new Error("redis error");
    mockDel.mockRejectedValueOnce(expectedError);
    const result = await RedisRepository.delLollipopDataForUser(deps)();

    expect(result).toEqual(E.left(expectedError));
  });

  it("should return success if the delete operation doesn't found any document to delete", async () => {
    mockDel.mockResolvedValueOnce(0);
    const result = await RedisRepository.delLollipopDataForUser(deps)();

    expect(result).toEqual(E.right(true));
  });
});

describe("Redis repository#delUserAllSessions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should succeed if user has no session", async () => {
    mockSmembers.mockResolvedValueOnce([]);
    mockDel.mockResolvedValueOnce(1);
    const result = await RedisRepository.delUserAllSessions(deps)();

    expect(result).toEqual(E.right(true));
  });

  it("should fail if there's an error retrieving user's sessions", async () => {
    const aError = new Error("any error");
    mockSmembers.mockImplementationOnce((_) => Promise.reject(aError));
    const result = await RedisRepository.delUserAllSessions(deps)();

    expect(result).toEqual(E.left(aError));
  });

  it("should fail if the stored user profile is not valid", async () => {
    const invalidProfile = { foo: "bar" };
    mockSmembers.mockResolvedValueOnce([mockSessionToken]);
    mockGet.mockImplementationOnce((_) => Promise.resolve(invalidProfile));

    const result = await RedisRepository.delUserAllSessions(deps)();

    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      left: {
        message: expect.stringContaining("is not valid JSON"),
      },
    });
  });

  it("should succeed if there's no user stored", async () => {
    mockSmembers.mockResolvedValueOnce([mockSessionToken]);
    mockGet.mockImplementationOnce((_) => Promise.resolve());
    mockDel.mockImplementationOnce((_) => Promise.resolve(1));

    const result = await RedisRepository.delUserAllSessions(deps)();

    expect(E.isRight(result)).toBeTruthy();
    expect(result).toEqual(E.right(true));
  });

  it("should succeed if everything is fine", async () => {
    mockSmembers.mockResolvedValueOnce([mockSessionToken]);
    mockGet.mockImplementationOnce((_) =>
      Promise.resolve(JSON.stringify(anUser)),
    );
    mockDel.mockImplementation((_) => Promise.resolve(1));
    mockSrem.mockImplementationOnce((_, __) => Promise.resolve(1));
    const result = await RedisRepository.delUserAllSessions(deps)();

    expect(mockDel).toHaveBeenCalledTimes(8);
    expect(result).toEqual(E.right(true));
  });
});
