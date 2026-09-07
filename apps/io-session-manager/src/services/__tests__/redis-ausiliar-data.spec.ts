import { describe, test, expect } from "vitest";
import * as O from "fp-ts/Option";
import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { Second } from "@pagopa/ts-commons/lib/units";
import {
  mockGetDel,
  mockSetEx,
  mockRedisClientSelector,
} from "../../__mocks__/redis.mocks";
import { LoginAusiliarData } from "../../types/oidc";
import { save, getAndDelete } from "../redis-ausiliar-data";

const aState = "a-state-token" as NonEmptyString;
const anExpireSec = 900 as Second;

const anAusiliarData: LoginAusiliarData = {
  clientId: "a-client-id" as NonEmptyString,
  lollipopAssertionRef:
    "sha256-anAssertionRef" as LoginAusiliarData["lollipopAssertionRef"],
  minAuthLevel: "SpidL2",
  nonce: "a-nonce" as NonEmptyString,
  oidcConfigurationEnv: "PROD",
};

const deps = { redisClientSelector: mockRedisClientSelector };

describe("RedisAuxiliarData#save", () => {
  test("should succeed and return true when the value is correctly stored", async () => {
    mockSetEx.mockImplementationOnce(() => Promise.resolve("OK"));

    await pipe(
      save(aState, anAusiliarData, anExpireSec)(deps),
      TE.map((result) => expect(result).toEqual(true)),
      TE.mapLeft((err) => expect(err).toBeFalsy()),
    )();

    expect(mockSetEx).toHaveBeenCalledTimes(1);
    expect(mockSetEx).toHaveBeenCalledWith(
      `RESERVE-${aState}`,
      anExpireSec,
      JSON.stringify(LoginAusiliarData.encode(anAusiliarData)),
    );
  });

  test("should fail with a left response if an error occurs on redis", async () => {
    const expectedError = new Error("redis Error");
    mockSetEx.mockImplementationOnce(() => Promise.reject(expectedError));

    await pipe(
      save(aState, anAusiliarData, anExpireSec)(deps),
      TE.map((result) => expect(result).toBeFalsy()),
      TE.mapLeft((err) => expect(err).toEqual(expectedError)),
    )();
  });

  test("should fail with a left response if redis does not reply with OK", async () => {
    mockSetEx.mockImplementationOnce(() => Promise.resolve(null));

    await pipe(
      save(aState, anAusiliarData, anExpireSec)(deps),
      TE.map((result) => expect(result).toBeFalsy()),
      TE.mapLeft((err) => expect(err).toBeTruthy()),
    )();
  });
});

describe("RedisAuxiliarData#getAndDelete", () => {
  test("should succeed and return the stored ausiliar data", async () => {
    mockGetDel.mockImplementationOnce(() =>
      Promise.resolve(JSON.stringify(LoginAusiliarData.encode(anAusiliarData))),
    );

    await pipe(
      getAndDelete(aState)(deps),
      TE.map((result) => expect(result).toEqual(O.some(anAusiliarData))),
      TE.mapLeft((err) => expect(err).toBeFalsy()),
    )();

    expect(mockGetDel).toHaveBeenCalledTimes(1);
    expect(mockGetDel).toHaveBeenCalledWith(`RESERVE-${aState}`);
  });

  test("should succeed and return none if the key is missing", async () => {
    mockGetDel.mockImplementationOnce(() => Promise.resolve(null));

    await pipe(
      getAndDelete(aState)(deps),
      TE.map((result) => expect(result).toEqual(O.none)),
      TE.mapLeft((err) => expect(err).toBeFalsy()),
    )();
  });

  test("should fail with a left response if an error occurs on redis", async () => {
    const expectedError = new Error("redis Error");
    mockGetDel.mockImplementationOnce(() => Promise.reject(expectedError));

    await pipe(
      getAndDelete(aState)(deps),
      TE.map((result) => expect(result).toBeFalsy()),
      TE.mapLeft((err) => expect(err).toEqual(expectedError)),
    )();
  });

  test("should fail with a left response if the stored value is invalid", async () => {
    mockGetDel.mockImplementationOnce(() => Promise.resolve("not-json"));

    await pipe(
      getAndDelete(aState)(deps),
      TE.map((result) => expect(result).toBeFalsy()),
      TE.mapLeft((err) => expect(err).toBeTruthy()),
    )();
  });
});
