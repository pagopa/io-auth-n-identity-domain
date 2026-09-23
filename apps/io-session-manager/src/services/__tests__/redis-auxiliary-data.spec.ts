import { describe, test, expect, afterEach, vi } from "vitest";
import * as O from "fp-ts/Option";
import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { Second } from "@pagopa/ts-commons/lib/units";
import {
  mockGet,
  mockDel,
  mockSetEx,
  mockRedisClientSelector,
} from "../../__mocks__/redis.mocks";
import { LoginAuxiliaryData } from "../../types/oidc";
import { save, getAndDelete } from "../redis-auxiliary-data";

const aState = "a-state-token" as NonEmptyString;
const anExpireSec = 900 as Second;

const anAuxiliaryData: LoginAuxiliaryData = {
  clientId: "a-client-id" as NonEmptyString,
  lollipopAssertionRef:
    "sha256-anAssertionRef" as LoginAuxiliaryData["lollipopAssertionRef"],
  minAuthLevel: "SpidL2",
  nonce: "a-nonce" as NonEmptyString,
  oidcConfigurationEnv: "PROD",
};

const deps = { redisClientSelector: mockRedisClientSelector };

describe("RedisAuxiliarData#save", () => {
  test("should succeed and return true when the value is correctly stored", async () => {
    mockSetEx.mockImplementationOnce(() => Promise.resolve("OK"));

    await pipe(
      save(aState, anAuxiliaryData, anExpireSec)(deps),
      TE.map((result) => expect(result).toEqual(true)),
      TE.mapLeft((err) => expect(err).toBeFalsy()),
    )();

    expect(mockSetEx).toHaveBeenCalledTimes(1);
    expect(mockSetEx).toHaveBeenCalledWith(
      `RESERVE-${aState}`,
      anExpireSec,
      JSON.stringify(LoginAuxiliaryData.encode(anAuxiliaryData)),
    );
  });

  test("should fail with a left response if an error occurs on redis", async () => {
    const expectedError = new Error("redis Error");
    mockSetEx.mockImplementationOnce(() => Promise.reject(expectedError));

    await pipe(
      save(aState, anAuxiliaryData, anExpireSec)(deps),
      TE.map((result) => expect(result).toBeFalsy()),
      TE.mapLeft((err) => expect(err).toEqual(expectedError)),
    )();
  });

  test("should fail with a left response if redis does not reply with OK", async () => {
    mockSetEx.mockImplementationOnce(() => Promise.resolve(null));

    await pipe(
      save(aState, anAuxiliaryData, anExpireSec)(deps),
      TE.map((result) => expect(result).toBeFalsy()),
      TE.mapLeft((err) => expect(err).toBeTruthy()),
    )();
  });
});

describe("RedisAuxiliarData#getAndDelete", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  test("should succeed and return the stored auxiliary data", async () => {
    mockGet.mockImplementationOnce(() =>
      Promise.resolve(JSON.stringify(LoginAuxiliaryData.encode(anAuxiliaryData))),
    );
    mockDel.mockImplementationOnce(() => Promise.resolve(1));

    await pipe(
      getAndDelete(aState)(deps),
      TE.map((result) => expect(result).toEqual(O.some(anAuxiliaryData))),
      TE.mapLeft((err) => expect(err).toBeFalsy()),
    )();

    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockGet).toHaveBeenCalledWith(`RESERVE-${aState}`);
    expect(mockDel).toHaveBeenCalledTimes(1);
    expect(mockDel).toHaveBeenCalledWith(`RESERVE-${aState}`);
  });

  test("should succeed and return none if the key is missing", async () => {
    mockGet.mockImplementationOnce(() => Promise.resolve(null));

    await pipe(
      getAndDelete(aState)(deps),
      TE.map((result) => expect(result).toEqual(O.none)),
      TE.mapLeft((err) => expect(err).toBeFalsy()),
    )();

    expect(mockDel).not.toHaveBeenCalled();
  });

  test("should fail with a left response if an error occurs on redis get", async () => {
    const expectedError = new Error("redis Error");
    mockGet.mockImplementationOnce(() => Promise.reject(expectedError));

    await pipe(
      getAndDelete(aState)(deps),
      TE.map((result) => expect(result).toBeFalsy()),
      TE.mapLeft((err) => expect(err).toEqual(expectedError)),
    )();

    expect(mockDel).not.toHaveBeenCalled();
  });

  test("should fail with a left response if an error occurs on redis del", async () => {
    const expectedError = new Error("redis Error");
    mockGet.mockImplementationOnce(() =>
      Promise.resolve(JSON.stringify(LoginAuxiliaryData.encode(anAuxiliaryData))),
    );
    mockDel.mockImplementationOnce(() => Promise.reject(expectedError));

    await pipe(
      getAndDelete(aState)(deps),
      TE.map((result) => expect(result).toBeFalsy()),
      TE.mapLeft((err) => expect(err).toEqual(expectedError)),
    )();
  });

  test("should fail with a left response if the stored value is invalid", async () => {
    mockGet.mockImplementationOnce(() => Promise.resolve("not-json"));
    mockDel.mockImplementationOnce(() => Promise.resolve(1));

    await pipe(
      getAndDelete(aState)(deps),
      TE.map((result) => expect(result).toBeFalsy()),
      TE.mapLeft((err) => expect(err).toBeTruthy()),
    )();
  });
});
