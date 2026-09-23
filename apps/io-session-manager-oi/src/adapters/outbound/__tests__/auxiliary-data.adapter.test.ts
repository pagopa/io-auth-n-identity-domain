import { GenericError, NotFoundError } from "@pagopa/hexagonal-core";
import { RedisObjectWrapper } from "@pagopa/redis/object-wrapper";
import { err, ok } from "neverthrow";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RedisClientType } from "redis";

import {
  AuxiliaryDataRedisAdapter,
  REDIS_AUXILIARY_DATA_PREFIX,
} from "../auxiliary-data.adapter.js";
import {
  LoginAuxiliaryData,
  LoginAuxiliaryDataSchema,
} from "../../../domain/value-objects/login.vo.js";
import { PositiveIntegerSchema } from "../../../domain/value-objects/positive-integer.vo.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ID = "d19de497-b356-483f-a9ce-9f8671615a9f";
const TTL_SECONDS = PositiveIntegerSchema.parse(900);

const AUXILIARY_DATA: LoginAuxiliaryData = {
  loginType: "LV",
  lollipopAssertionRef:
    "sha256-thumbprint" as LoginAuxiliaryData["lollipopAssertionRef"],
  clientId: "client-id" as LoginAuxiliaryData["clientId"],
  minAuthLevel: "SpidL2",
  oidcConfigurationEnv: "PROD",
  nonce: "a-nonce" as LoginAuxiliaryData["nonce"],
};

const saveMock = vi.fn();
const getAndDeleteMock = vi.fn();
const pingMock = vi.fn();
const getClientMock = vi.fn(() => ({ ping: pingMock }));

const wrapperStub = {
  save: saveMock,
  getAndDelete: getAndDeleteMock,
  getClient: getClientMock,
} as unknown as RedisObjectWrapper<
  typeof LoginAuxiliaryDataSchema,
  RedisClientType
>;

const adapter = new AuxiliaryDataRedisAdapter(wrapperStub, TTL_SECONDS);

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// healthcheck
// ---------------------------------------------------------------------------

describe("AuxiliaryDataRedisAdapter#healthcheck", () => {
  it("returns ok(undefined) when PING replies PONG", async () => {
    pingMock.mockResolvedValueOnce("PONG");

    const result = await adapter.healthcheck();

    expect(pingMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual(ok(undefined));
  });

  it("returns err(GenericError) when PING replies with an unexpected value", async () => {
    pingMock.mockResolvedValueOnce("NOT-PONG");

    const result = await adapter.healthcheck();

    expect(result.isErr()).toBe(true);
    const error = result._unsafeUnwrapErr();
    expect(error).toBeInstanceOf(GenericError);
    expect(error.message).toContain("NOT-PONG");
  });

  it("returns err(GenericError) when PING rejects", async () => {
    pingMock.mockRejectedValueOnce(new Error("connection refused"));

    const result = await adapter.healthcheck();

    expect(result.isErr()).toBe(true);
    const error = result._unsafeUnwrapErr();
    expect(error).toBeInstanceOf(GenericError);
    expect(error.message).toContain("connection refused");
  });
});

// ---------------------------------------------------------------------------
// save
// ---------------------------------------------------------------------------

describe("AuxiliaryDataRedisAdapter#save", () => {
  it("returns ok(undefined) when the wrapper saves successfully", async () => {
    saveMock.mockResolvedValueOnce(ok(undefined));

    const result = await adapter.save(ID, AUXILIARY_DATA);

    expect(saveMock).toHaveBeenCalledExactlyOnceWith(
      `${REDIS_AUXILIARY_DATA_PREFIX}${ID}`,
      AUXILIARY_DATA,
      { expiration: { type: "EX", value: TTL_SECONDS } },
    );
    expect(result).toEqual(ok(undefined));
  });

  it("returns err(GenericError) when the wrapper reports an error", async () => {
    const wrapperError = new GenericError("SET failed");
    saveMock.mockResolvedValueOnce(err(wrapperError));

    const result = await adapter.save(ID, AUXILIARY_DATA);

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toEqual(
      new GenericError(`Redis save operation failed: ${wrapperError.message}`),
    );
  });
});

// ---------------------------------------------------------------------------
// retrieve
// ---------------------------------------------------------------------------

describe("AuxiliaryDataRedisAdapter#retrieve", () => {
  it("returns ok(LoginAuxiliaryData) when the wrapper finds the value", async () => {
    getAndDeleteMock.mockResolvedValueOnce(ok(AUXILIARY_DATA));

    const result = await adapter.retrieve(ID);

    expect(getAndDeleteMock).toHaveBeenCalledExactlyOnceWith(
      `${REDIS_AUXILIARY_DATA_PREFIX}${ID}`,
    );
    expect(result).toEqual(ok(AUXILIARY_DATA));
  });

  it("returns ok(undefined) when the wrapper finds no value", async () => {
    getAndDeleteMock.mockResolvedValueOnce(ok(undefined));

    const result = await adapter.retrieve(ID);

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toEqual(
      new NotFoundError("LoginAuxiliaryData", "LoginAuxiliaryData Not Found"),
    );
  });

  it("returns err(GenericError) when the wrapper reports an error", async () => {
    const wrapperError = new GenericError("GET failed");
    getAndDeleteMock.mockResolvedValueOnce(err(wrapperError));

    const result = await adapter.retrieve(ID);

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toEqual(
      new GenericError(
        `Redis retrieve operation failed: ${wrapperError.message}`,
      ),
    );
  });
});
