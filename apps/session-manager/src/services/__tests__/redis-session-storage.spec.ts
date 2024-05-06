import { describe, test, expect, Mock, beforeEach, vi } from "vitest";
import * as E from "fp-ts/Either";
import * as O from "fp-ts/Option";
import { FiscalCode } from "@pagopa/ts-commons/lib/strings";
import { errorsToReadableMessages } from "@pagopa/ts-commons/lib/reporters";
import { ValidationError } from "io-ts";
import { multipleErrorsFormatter } from "../../utils/errors";
import {
  mockSadd,
  mockSetEx,
  mockSmembers,
  mockRedisClientSelector,
  mockGet,
} from "../../__mocks__/redis.mocks";
import { mockedUser } from "../../__mocks__/user.mocks";
import {
  getBySessionToken,
  getLollipopAssertionRefForUser,
  set,
} from "../redis-session-storage";
import { SessionToken } from "../../types/token";
import { User } from "../../types/user";
import { anAssertionRef } from "../../__mocks__/lollipop.mocks";
import { LoginTypeEnum } from "../../types/fast-login";

const anInvalidFiscalCode = "INVALID-FC" as FiscalCode;

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
    mockGet.mockImplementationOnce((_) => Promise.resolve(null));

    const response = await getBySessionToken({
      redisClientSelector: mockRedisClientSelector,
      token: "inexistent token" as SessionToken,
    })();
    expect(response).toEqual(E.right(O.none));
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
    const response = await getBySessionToken({
      redisClientSelector: mockRedisClientSelector,
      token: aValidUser.session_token,
    })();

    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockGet).toHaveBeenCalledWith(`SESSION-${aValidUser.session_token}`);
    expect(response).toEqual(E.left(expectedError));
  });

  test("should fail parse of user payload", async () => {
    mockGet.mockImplementationOnce((_) => Promise.resolve("Invalid JSON"));

    const response = await getBySessionToken({
      redisClientSelector: mockRedisClientSelector,
      token: aValidUser.session_token,
    })();

    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockGet).toHaveBeenCalledWith(`SESSION-${aValidUser.session_token}`);
    expect(response).toEqual(
      E.left(new SyntaxError("Unexpected token I in JSON at position 0")),
    );
  });

  test("should return error if the session is expired", async () => {
    mockGet.mockImplementationOnce((_) => Promise.resolve(null));
    const response = await getBySessionToken({
      redisClientSelector: mockRedisClientSelector,
      token: aValidUser.session_token,
    })();

    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(response).toEqual(E.right(O.none));
  });

  test("should get a session with valid values", async () => {
    mockGet.mockImplementationOnce((_) =>
      Promise.resolve(JSON.stringify(aValidUser)),
    );

    const response = await getBySessionToken({
      redisClientSelector: mockRedisClientSelector,
      token: aValidUser.session_token,
    })();

    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockGet).toHaveBeenCalledWith(`SESSION-${aValidUser.session_token}`);
    expect(response).toEqual(E.right(O.some(aValidUser)));
  });
});

describe("RedisSessionStorage#getLollipopAssertionRefForUser", () => {
  test("should success and return an assertionRef", async () => {
    mockGet.mockImplementationOnce((_) => Promise.resolve(anAssertionRef));
    const response = await getLollipopAssertionRefForUser({
      redisClientSelector: mockRedisClientSelector,
      fiscalCode: aValidUser.fiscal_code,
    })();

    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockGet).toBeCalledWith(`KEYS-${aValidUser.fiscal_code}`);

    expect(response).toEqual(E.right(O.some(anAssertionRef)));
  });

  test("should success and return an assertionRef, if data is stored in new format", async () => {
    mockGet.mockImplementationOnce((_) =>
      Promise.resolve(
        JSON.stringify({ a: anAssertionRef, t: LoginTypeEnum.LEGACY }),
      ),
    );
    const response = await getLollipopAssertionRefForUser({
      redisClientSelector: mockRedisClientSelector,
      fiscalCode: aValidUser.fiscal_code,
    })();

    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockGet).toBeCalledWith(`KEYS-${aValidUser.fiscal_code}`);

    expect(response).toEqual(E.right(O.some(anAssertionRef)));
  });

  test("should success and return none if assertionRef is missing", async () => {
    mockGet.mockImplementationOnce((_) => Promise.resolve(null));
    const response = await getLollipopAssertionRefForUser({
      redisClientSelector: mockRedisClientSelector,
      fiscalCode: aValidUser.fiscal_code,
    })();

    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockGet).toBeCalledWith(`KEYS-${aValidUser.fiscal_code}`);
    expect(E.isRight(response)).toBeTruthy();
    if (E.isRight(response)) expect(O.isNone(response.right)).toBeTruthy();
  });
  test("should fail with a left response if an error occurs on redis", async () => {
    const expectedError = new Error("redis Error");
    mockGet.mockImplementationOnce((_) => Promise.reject(expectedError));
    const response = await getLollipopAssertionRefForUser({
      redisClientSelector: mockRedisClientSelector,
      fiscalCode: aValidUser.fiscal_code,
    })();

    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockGet).toBeCalledWith(`KEYS-${aValidUser.fiscal_code}`);
    expect(E.isLeft(response)).toBeTruthy();
    if (E.isLeft(response)) expect(response.left).toEqual(expectedError);
  });

  test("should fail with a left response if the value stored is invalid", async () => {
    mockGet.mockImplementationOnce((_) => Promise.resolve("an invalid value"));
    const response = await getLollipopAssertionRefForUser({
      redisClientSelector: mockRedisClientSelector,
      fiscalCode: aValidUser.fiscal_code,
    })();

    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockGet).toBeCalledWith(`KEYS-${aValidUser.fiscal_code}`);
    expect(E.isLeft(response)).toBeTruthy();
  });
});
