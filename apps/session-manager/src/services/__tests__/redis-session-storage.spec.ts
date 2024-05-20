import { describe, test, expect, Mock, beforeEach, vi } from "vitest";
import * as E from "fp-ts/Either";
import * as O from "fp-ts/Option";
import { FiscalCode } from "@pagopa/ts-commons/lib/strings";
import { errorsToReadableMessages } from "@pagopa/ts-commons/lib/reporters";
import { ValidationError } from "io-ts";
import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";
import { multipleErrorsFormatter } from "../../utils/errors";
import {
  mockSadd,
  mockSetEx,
  mockSmembers,
  mockRedisClientSelector,
  mockGet,
  mockDel,
  mockSrem,
} from "../../__mocks__/redis.mocks";
import { aFiscalCode, mockedUser } from "../../__mocks__/user.mocks";
import {
  delLollipopDataForUser,
  deleteUser,
  getByFIMSToken,
  getBySessionToken,
  getLollipopAssertionRefForUser,
  set,
} from "../redis-session-storage";
import { SessionToken } from "../../types/token";
import { User } from "../../types/user";
import { anAssertionRef } from "../../__mocks__/lollipop.mocks";
import { LoginTypeEnum } from "../../types/fast-login";

const anInvalidFiscalCode = "INVALID-FC" as FiscalCode;

const INVALID_JSON = "Invalid JSON";
const expectedInvalidJSONError = new SyntaxError(
  "Unexpected token I in JSON at position 0",
);

const redisMethodImplFromError = (
  mockFunction: Mock,
  success?: unknown,
  error?: Error,
) =>
  mockFunction.mockImplementationOnce(() =>
    error ? Promise.reject(error) : Promise.resolve(success),
  );
const aValidUser = mockedUser;

// mock for a invalid User
const anInvalidUser: User = {
  ...aValidUser,
  fiscal_code: anInvalidFiscalCode,
};

export const mockSessionToken =
  "c77de47586c841adbd1a1caeb90dce25dcecebed620488a4f932a6280b10ee99a77b6c494a8a6e6884ccbeb6d3fe736b" as SessionToken;

mockSetEx.mockImplementation((_, __, ___) => Promise.resolve("OK"));
mockSadd.mockImplementation((_, __) => Promise.resolve(1));
mockSmembers.mockImplementation((_) => Promise.resolve([mockSessionToken]));
mockGet.mockImplementation((_) => Promise.resolve(JSON.stringify(aValidUser)));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("RedisSessionStorage#set", () => {
  const hmErrorRedis = new Error("hmset error");
  const hErrorRedis = new Error("hset error");
  const errorMessage = "RedisSessionStorage.set";
  const tokenSetError = new Error("Error setting session token");
  const walletTokenSetError = new Error("Error setting wallet token");
  test.each`
    sessionSetErr   | sessionSetSuccess | walletSetErr   | walletSetSuccess | myPortalSetError | myPortalSetSuccess | bpdSetError  | bpdSetSuccess | zendeskSetError | zendeskSetSuccess | expected                                                                               | testTitle
    ${undefined}    | ${"OK"}           | ${undefined}   | ${"OK"}          | ${undefined}     | ${"OK"}            | ${undefined} | ${"OK"}       | ${undefined}    | ${"OK"}           | ${E.right(true)}                                                                       | ${"should set a new session with valid values"}
    ${hmErrorRedis} | ${undefined}      | ${undefined}   | ${"OK"}          | ${undefined}     | ${"OK"}            | ${undefined} | ${"OK"}       | ${undefined}    | ${"OK"}           | ${E.left(multipleErrorsFormatter([hmErrorRedis], errorMessage))}                       | ${"should fail if Redis client returns an error on saving the session"}
    ${hmErrorRedis} | ${undefined}      | ${hErrorRedis} | ${undefined}     | ${undefined}     | ${"OK"}            | ${undefined} | ${"OK"}       | ${undefined}    | ${"OK"}           | ${E.left(multipleErrorsFormatter([hmErrorRedis, hErrorRedis], errorMessage))}          | ${"should fail if Redis client returns an error on saving the session and error saving the mapping"}
    ${hmErrorRedis} | ${undefined}      | ${undefined}   | ${undefined}     | ${undefined}     | ${"OK"}            | ${undefined} | ${"OK"}       | ${undefined}    | ${"OK"}           | ${E.left(multipleErrorsFormatter([hmErrorRedis, walletTokenSetError], errorMessage))}  | ${"should fail if Redis client returns an error on saving the session and false saving the mapping"}
    ${undefined}    | ${undefined}      | ${undefined}   | ${"OK"}          | ${undefined}     | ${"OK"}            | ${undefined} | ${"OK"}       | ${undefined}    | ${"OK"}           | ${E.left(multipleErrorsFormatter([tokenSetError], errorMessage))}                      | ${"should fail if Redis client returns false on saving the session"}
    ${undefined}    | ${undefined}      | ${undefined}   | ${undefined}     | ${undefined}     | ${"OK"}            | ${undefined} | ${"OK"}       | ${undefined}    | ${"OK"}           | ${E.left(multipleErrorsFormatter([tokenSetError, walletTokenSetError], errorMessage))} | ${"should fail if Redis client returns false on saving the session and false saving the mapping"}
    ${undefined}    | ${"OK"}           | ${hErrorRedis} | ${undefined}     | ${undefined}     | ${"OK"}            | ${undefined} | ${"OK"}       | ${undefined}    | ${"OK"}           | ${E.left(multipleErrorsFormatter([hErrorRedis], errorMessage))}                        | ${"should fail if Redis client returns an error on saving the mapping"}
    ${undefined}    | ${undefined}      | ${hErrorRedis} | ${undefined}     | ${undefined}     | ${"OK"}            | ${undefined} | ${"OK"}       | ${undefined}    | ${"OK"}           | ${E.left(multipleErrorsFormatter([tokenSetError, hErrorRedis], errorMessage))}         | ${"should fail if Redis client returns an error on saving the mapping and false saving the session"}
    ${undefined}    | ${"OK"}           | ${undefined}   | ${undefined}     | ${undefined}     | ${"OK"}            | ${undefined} | ${"OK"}       | ${undefined}    | ${"OK"}           | ${E.left(multipleErrorsFormatter([walletTokenSetError], errorMessage))}                | ${"should fail if Redis client returns false on saving the mapping"}
  `(
    "$testTitle",
    async ({
      sessionSetErr,
      sessionSetSuccess,
      walletSetErr,
      walletSetSuccess,
      myPortalSetError,
      myPortalSetSuccess,
      bpdSetError,
      bpdSetSuccess,
      zendeskSetError,
      zendeskSetSuccess,
      expected,
    }) => {
      redisMethodImplFromError(mockSetEx, sessionSetSuccess, sessionSetErr);
      redisMethodImplFromError(mockSetEx, walletSetSuccess, walletSetErr);
      redisMethodImplFromError(mockSetEx, myPortalSetSuccess, myPortalSetError);
      redisMethodImplFromError(mockSetEx, bpdSetSuccess, bpdSetError);
      redisMethodImplFromError(mockSetEx, zendeskSetSuccess, zendeskSetError);

      // FIMS Token
      redisMethodImplFromError(mockSetEx, "OK");
      redisMethodImplFromError(mockSetEx, "OK");
      redisMethodImplFromError(mockSadd, 1);
      redisMethodImplFromError(mockSmembers, []);

      const expectedTTL = 42;
      const response = await set(
        mockRedisClientSelector,
        expectedTTL,
      )(aValidUser)();

      expect(mockSetEx).toHaveBeenCalledTimes(7);

      expect(mockSetEx).toHaveBeenNthCalledWith(
        1,
        `SESSION-${aValidUser.session_token}`,
        expectedTTL,
        JSON.stringify(aValidUser),
      );
      expect(mockSetEx).toHaveBeenNthCalledWith(
        2,
        `WALLET-${aValidUser.wallet_token}`,
        expectedTTL,
        aValidUser.session_token,
      );
      expect(mockSetEx).toHaveBeenNthCalledWith(
        3,
        `MYPORTAL-${aValidUser.myportal_token}`,
        expectedTTL,
        aValidUser.session_token,
      );
      expect(mockSetEx).toHaveBeenNthCalledWith(
        4,
        `BPD-${aValidUser.bpd_token}`,
        expectedTTL,
        aValidUser.session_token,
      );
      expect(mockSetEx).toHaveBeenNthCalledWith(
        5,
        `ZENDESK-${aValidUser.zendesk_token}`,
        expectedTTL,
        aValidUser.session_token,
      );
      expect(mockSetEx).toHaveBeenNthCalledWith(
        6,
        `FIMS-${aValidUser.fims_token}`,
        expectedTTL,
        aValidUser.session_token,
      );
      expect(mockSetEx).toHaveBeenNthCalledWith(
        7,
        `SESSIONINFO-${aValidUser.session_token}`,
        expectedTTL,
        expect.any(String),
      );
      expect(JSON.parse(mockSetEx.mock.calls[6][2])).toHaveProperty(
        "createdAt",
      );

      expect(mockSadd).toHaveBeenCalled();

      expect(response).toEqual(expected);
    },
  );

  test("should not call sAdd if is an update", async () => {
    redisMethodImplFromError(mockSetEx, "OK");
    redisMethodImplFromError(mockSetEx, "OK");
    redisMethodImplFromError(mockSetEx, "OK");
    redisMethodImplFromError(mockSetEx, "OK");
    redisMethodImplFromError(mockSetEx, "OK");
    // FIMS Token
    redisMethodImplFromError(mockSetEx, "OK");

    await set(mockRedisClientSelector, 100)(aValidUser, true)();

    expect(mockSadd).not.toHaveBeenCalled();
  });
});

describe("RedisSessionStorage#getBySessionToken", () => {
  test("should fail getting a session for an inexistent token", async () => {
    // This test could be a duplication of "should return error if the session is expired"
    mockGet.mockImplementationOnce((_) => Promise.resolve(null));

    await pipe(
      getBySessionToken({
        redisClientSelector: mockRedisClientSelector,
        token: "inexistent token" as SessionToken,
      }),
      TE.map((result) => expect(result).toEqual(O.none)),
      TE.mapLeft((err) => expect(err).toBeFalsy()),
    )();
  });

  test("should fail getting a session with invalid value", async () => {
    mockGet.mockImplementationOnce((_) =>
      Promise.resolve(JSON.stringify(anInvalidUser)),
    );

    const expectedDecodedError = User.decode(anInvalidUser) as E.Left<
      ReadonlyArray<ValidationError>
    >;
    const expectedError = new Error(
      errorsToReadableMessages(expectedDecodedError.left).join("/"),
    );
    await pipe(
      getBySessionToken({
        redisClientSelector: mockRedisClientSelector,
        token: aValidUser.session_token,
      }),
      TE.map((result) => expect(result).toBeFalsy()),
      TE.mapLeft((err) => expect(err).toEqual(expectedError)),
    )();

    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockGet).toHaveBeenCalledWith(`SESSION-${aValidUser.session_token}`);
  });

  test("should fail parse of user payload", async () => {
    mockGet.mockResolvedValueOnce(INVALID_JSON);

    await pipe(
      getBySessionToken({
        redisClientSelector: mockRedisClientSelector,
        token: aValidUser.session_token,
      }),
      TE.map((result) => expect(result).toBeFalsy()),
      TE.mapLeft((err) => expect(err).toEqual(expectedInvalidJSONError)),
    )();

    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockGet).toHaveBeenCalledWith(`SESSION-${aValidUser.session_token}`);
  });

  test("should return error if the session is expired", async () => {
    mockGet.mockImplementationOnce((_) => Promise.resolve(null));
    await pipe(
      getBySessionToken({
        redisClientSelector: mockRedisClientSelector,
        token: aValidUser.session_token,
      }),
      TE.map((result) => expect(result).toEqual(O.none)),
      TE.mapLeft((err) => expect(err).toBeFalsy()),
    )();

    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockGet).toHaveBeenCalledWith(`SESSION-${aValidUser.session_token}`);
  });

  test("should get a session with valid values", async () => {
    mockGet.mockImplementationOnce((_) =>
      Promise.resolve(JSON.stringify(aValidUser)),
    );

    await pipe(
      getBySessionToken({
        redisClientSelector: mockRedisClientSelector,
        token: aValidUser.session_token,
      }),
      TE.map((result) => expect(result).toEqual(O.some(aValidUser))),
      TE.mapLeft((err) => expect(err).toBeFalsy()),
    )();

    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockGet).toHaveBeenCalledWith(`SESSION-${aValidUser.session_token}`);
  });
});

describe("RedisSessionStorage#getByFIMSToken", () => {
  const mockedDependencies = {
    redisClientSelector: mockRedisClientSelector,
  };

  test("should get the session with a valid token", async () => {
    mockGet.mockResolvedValueOnce(mockSessionToken);
    mockGet.mockImplementationOnce((_) =>
      Promise.resolve(JSON.stringify(aValidUser)),
    );

    await pipe(
      mockedDependencies,
      getByFIMSToken(aValidUser.fims_token),
      TE.map((result) => expect(result).toEqual(O.some(aValidUser))),
      TE.mapLeft((err) => expect(err).toBeFalsy()),
    )();

    expect(mockGet).toHaveBeenCalledTimes(2);
    expect(mockGet).toHaveBeenCalledWith(`FIMS-${aValidUser.fims_token}`);
    expect(mockGet).toHaveBeenCalledWith(`SESSION-${aValidUser.session_token}`);
  });

  test.each`
    title                           | token
    ${"token is invalid"}           | ${"inexistent token"}
    ${"token is valid but expired"} | ${aValidUser.fims_token}
  `("should return O.none if token", async ({ token }) => {
    mockGet.mockImplementationOnce((_) => Promise.resolve(null));

    await pipe(
      mockedDependencies,
      getByFIMSToken(token),
      TE.map((result) => expect(result).toEqual(O.none)),
      TE.mapLeft((err) => expect(err).toBeFalsy()),
    )();
  });

  test("should fail getting a session with invalid value", async () => {
    mockGet.mockImplementationOnce((_) => Promise.resolve(mockSessionToken));
    mockGet.mockImplementationOnce((_) =>
      Promise.resolve(JSON.stringify(anInvalidUser)),
    );

    const expectedDecodedError = User.decode(anInvalidUser) as E.Left<
      ReadonlyArray<ValidationError>
    >;
    const expectedError = new Error(
      errorsToReadableMessages(expectedDecodedError.left).join("/"),
    );

    await pipe(
      mockedDependencies,
      getByFIMSToken(aValidUser.fims_token),
      TE.map((result) => expect(result).toEqual(O.none)),
      TE.mapLeft((err) => expect(err).toEqual(expectedError)),
    )();

    expect(mockGet).toHaveBeenCalledTimes(2);
    expect(mockGet.mock.calls[0][0]).toBe(`FIMS-${aValidUser.fims_token}`);
    expect(mockGet.mock.calls[1][0]).toBe(
      `SESSION-${aValidUser.session_token}`,
    );
  });

  test("should return error if the session is expired", async () => {
    mockGet.mockResolvedValueOnce(mockSessionToken);
    mockGet.mockResolvedValueOnce(INVALID_JSON);

    await pipe(
      mockedDependencies,
      getByFIMSToken(aValidUser.fims_token),
      TE.map((result) => expect(result).toEqual(O.none)),
      TE.mapLeft((err) => expect(err).toEqual(expectedInvalidJSONError)),
    )();

    expect(mockGet).toHaveBeenCalledTimes(2);
    expect(mockGet.mock.calls[0][0]).toBe(`FIMS-${aValidUser.fims_token}`);
    expect(mockGet.mock.calls[1][0]).toBe(
      `SESSION-${aValidUser.session_token}`,
    );
  });

  test("should fail parse of user payload", async () => {
    mockGet.mockResolvedValueOnce(mockSessionToken);
    mockGet.mockResolvedValueOnce(INVALID_JSON);

    await pipe(
      {
        redisClientSelector: mockRedisClientSelector,
      },
      getByFIMSToken(aValidUser.fims_token),
      TE.map((result) => expect(result).toEqual(O.none)),
      TE.mapLeft((err) => expect(err).toEqual(expectedInvalidJSONError)),
    )();

    expect(mockGet).toHaveBeenCalledTimes(2);
    expect(mockGet.mock.calls[0][0]).toBe(`FIMS-${aValidUser.fims_token}`);
    expect(mockGet.mock.calls[1][0]).toBe(
      `SESSION-${aValidUser.session_token}`,
    );
  });
});

describe("RedisSessionStorage#getLollipopAssertionRefForUser", () => {
  test("should success and return an assertionRef", async () => {
    mockGet.mockImplementationOnce((_) => Promise.resolve(anAssertionRef));
    await pipe(
      getLollipopAssertionRefForUser({
        redisClientSelector: mockRedisClientSelector,
        fiscalCode: aValidUser.fiscal_code,
      }),
      TE.map((result) => expect(result).toEqual(O.some(anAssertionRef))),
      TE.mapLeft((err) => expect(err).toBeFalsy()),
    )();

    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockGet).toBeCalledWith(`KEYS-${aValidUser.fiscal_code}`);
  });

  test("should success and return an assertionRef, if data is stored in new format", async () => {
    mockGet.mockImplementationOnce((_) =>
      Promise.resolve(
        JSON.stringify({ a: anAssertionRef, t: LoginTypeEnum.LEGACY }),
      ),
    );
    await pipe(
      getLollipopAssertionRefForUser({
        redisClientSelector: mockRedisClientSelector,
        fiscalCode: aValidUser.fiscal_code,
      }),
      TE.map((result) => expect(result).toEqual(O.some(anAssertionRef))),
      TE.mapLeft((err) => expect(err).toBeFalsy()),
    )();

    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockGet).toBeCalledWith(`KEYS-${aValidUser.fiscal_code}`);
  });

  test("should success and return none if assertionRef is missing", async () => {
    mockGet.mockImplementationOnce((_) => Promise.resolve(null));
    await pipe(
      getLollipopAssertionRefForUser({
        redisClientSelector: mockRedisClientSelector,
        fiscalCode: aValidUser.fiscal_code,
      }),
      TE.map((result) => expect(result).toEqual(O.none)),
      TE.mapLeft((err) => expect(err).toBeFalsy()),
    )();

    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockGet).toBeCalledWith(`KEYS-${aValidUser.fiscal_code}`);
  });

  test("should fail with a left response if an error occurs on redis", async () => {
    const expectedError = new Error("redis Error");
    mockGet.mockImplementationOnce((_) => Promise.reject(expectedError));
    await pipe(
      getLollipopAssertionRefForUser({
        redisClientSelector: mockRedisClientSelector,
        fiscalCode: aValidUser.fiscal_code,
      }),
      TE.map((result) => expect(result).toBeFalsy()),
      TE.mapLeft((err) => expect(err).toEqual(expectedError)),
    )();

    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockGet).toBeCalledWith(`KEYS-${aValidUser.fiscal_code}`);
  });

  test("should fail with a left response if the value stored is invalid", async () => {
    mockGet.mockImplementationOnce((_) => Promise.resolve("an invalid value"));
    await pipe(
      getLollipopAssertionRefForUser({
        redisClientSelector: mockRedisClientSelector,
        fiscalCode: aValidUser.fiscal_code,
      }),
      TE.map((result) => expect(result).toBeFalsy()),
      TE.mapLeft((err) => expect(err).toBeTruthy()),
    )();

    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockGet).toBeCalledWith(`KEYS-${aValidUser.fiscal_code}`);
  });
});

describe("RedisSessionStorage#delLollipopDataForUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("should success and return true if one element if removed", async () => {
    mockDel.mockResolvedValueOnce(1);
    const result = await pipe(
      delLollipopDataForUser({
        fiscalCode: aFiscalCode,
        redisClientSelector: mockRedisClientSelector,
      }),
      TE.map((value) => {
        expect(value).toEqual(true);
      }),
    )();
    expect(E.isRight(result)).toBeTruthy();
  });

  test("should return an error if delete rise an error", async () => {
    const expectedError = new Error("redis error");
    mockDel.mockRejectedValueOnce(expectedError);
    const result = await pipe(
      delLollipopDataForUser({
        fiscalCode: aFiscalCode,
        redisClientSelector: mockRedisClientSelector,
      }),
      TE.mapLeft((value) => {
        expect(value).toEqual(expectedError);
      }),
    )();
    expect(E.isLeft(result)).toBeTruthy();
  });

  test("should return success if the delete operation doesn't found any document to delete", async () => {
    mockDel.mockResolvedValueOnce(0);
    const result = await pipe(
      delLollipopDataForUser({
        fiscalCode: aFiscalCode,
        redisClientSelector: mockRedisClientSelector,
      }),
      TE.map((value) => {
        expect(value).toEqual(true);
      }),
    )();
    expect(E.isRight(result)).toBeTruthy();
  });
});

describe("RedisSessionStorage#deleteUser", () => {
  const mockedDependencies = {
    redisClientSelector: mockRedisClientSelector,
  };

  const TOKENS = [
    `BPD-${aValidUser.bpd_token}`,
    `FIMS-${aValidUser.fims_token}`,
    `MYPORTAL-${aValidUser.myportal_token}`,
    `SESSIONINFO-${aValidUser.session_token}`,
    `SESSION-${aValidUser.session_token}`,
    `WALLET-${aValidUser.wallet_token}`,
    `ZENDESK-${aValidUser.zendesk_token}`,
  ];

  test("should succeed deleting all user tokens, if no error occurrs", async () => {
    mockSrem.mockImplementationOnce((_, __) => Promise.resolve(1));
    for (let i = 0; i < TOKENS.length; i++)
      redisMethodImplFromError(mockDel, 1, undefined);

    const response = await pipe(mockedDependencies, deleteUser(aValidUser))();

    expect(response).toEqual(E.right(true));

    expect(mockDel).toHaveBeenCalledTimes(TOKENS.length);
    expect(mockSrem).toHaveBeenCalledTimes(1);

    for (let i = 0; i < TOKENS.length; i++)
      expect(mockDel).toHaveBeenNthCalledWith(i + 1, TOKENS[i]);
    expect(mockSrem).toHaveBeenCalledWith(
      `USERSESSIONS-${aValidUser.fiscal_code}`,
      `SESSIONINFO-${aValidUser.session_token}`,
    );
  });

  test("should fail when Redis client returns an error on deleting the user tokens", async () => {
    const errorMessage = "a delete error";
    const successDeletion = 3;

    redisMethodImplFromError(mockDel, 1, undefined);
    redisMethodImplFromError(mockDel, 1, undefined);
    redisMethodImplFromError(mockDel, 1, Error(errorMessage));

    const response = await pipe(mockedDependencies, deleteUser(aValidUser))();

    expect(response).toEqual(
      E.left(Error(`value [${errorMessage}] at RedisSessionStorage.del`)),
    );

    expect(mockDel).toHaveBeenCalledTimes(successDeletion);
    expect(mockSrem).toHaveBeenCalledTimes(0);

    for (let i = 0; i < successDeletion; i++)
      expect(mockDel).toHaveBeenNthCalledWith(i + 1, TOKENS[i]);
  });

  test("should fail if Redis client returns an error deleting the session and false deleting the mapping", async () => {
    const errorMessage =
      "Unexpected response from redis client deleting user tokens.";

    mockSrem.mockImplementationOnce((_, __) => Promise.resolve(1));
    for (let i = 0; i < TOKENS.length; i++)
      redisMethodImplFromError(mockDel, 0, undefined);

    const response = await pipe(mockedDependencies, deleteUser(aValidUser))();

    expect(response).toEqual(
      E.left(Error(`value [${errorMessage}] at RedisSessionStorage.del`)),
    );

    expect(mockDel).toHaveBeenCalledTimes(TOKENS.length);
    expect(mockSrem).toHaveBeenCalledTimes(0);

    for (let i = 0; i < TOKENS.length; i++)
      expect(mockDel).toHaveBeenNthCalledWith(i + 1, TOKENS[i]);
  });
});
