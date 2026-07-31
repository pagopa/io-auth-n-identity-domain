import {
  AuthenticationError,
  GatewayTimeoutError,
  GenericError,
  ServiceUnavailableError,
  ValidationError,
} from "@pagopa/hexagonal-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { RedisObjectWrapper } from "../object-wrapper.js";
import { RedisClientType, RedisClusterType } from "redis";

const KEY = "RESERVE-abc";

const ValueSchema = z.object({ id: z.string(), name: z.string() });
const VALUE = { id: "1", name: "Ada" };

const getMock = vi.fn();
const setMock = vi.fn();

const clientStub = {
  get: getMock,
  set: setMock,
} as unknown as RedisClusterType;

const wrapper = new RedisObjectWrapper(clientStub, ValueSchema);

const buildRedisError = (name: string, message: string): Error => {
  const error = new Error(message);
  error.name = name;
  return error;
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("RedisObjectWrapper#getClient", () => {
  it("returns the underlying client (escape hatch)", () => {
    expect(wrapper.getClient()).toBe(clientStub);
  });
});

describe("RedisObjectWrapper#save", () => {
  it("should store the JSON object", async () => {
    setMock.mockResolvedValueOnce("OK");

    const result = await wrapper.save(KEY, VALUE);

    expect(result.isOk()).toBe(true);
    expect(setMock).toHaveBeenCalledExactlyOnceWith(KEY, JSON.stringify(VALUE));
  });

  it("should return ValidationError when the value doesn't match the schema", async () => {
    const result = await wrapper.save(KEY, { id: "1" } as unknown as {
      id: string;
      name: string;
    });

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toBeInstanceOf(ValidationError);
    expect(setMock).not.toHaveBeenCalled();
  });

  it("should classify NOAUTH replies as AuthenticationError", async () => {
    setMock.mockRejectedValueOnce(
      buildRedisError("ErrorReply", "NOAUTH Authentication required."),
    );

    const result = await wrapper.save(KEY, VALUE);

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toBeInstanceOf(AuthenticationError);
  });

  it("should classify ConnectionTimeoutError as GatewayTimeoutError", async () => {
    setMock.mockRejectedValueOnce(
      buildRedisError("ConnectionTimeoutError", "connect ETIMEDOUT"),
    );

    const result = await wrapper.save(KEY, VALUE);

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toBeInstanceOf(GatewayTimeoutError);
  });

  it("should return GenericError for unknown failures", async () => {
    setMock.mockRejectedValueOnce(new Error("something odd"));

    const result = await wrapper.save(KEY, VALUE);

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toBeInstanceOf(GenericError);
  });
});

describe("RedisObjectWrapper#get", () => {
  it("returns ok(undefined) when the key doesn't exist", async () => {
    getMock.mockResolvedValueOnce(null);

    const result = await wrapper.get(KEY);

    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toBeUndefined();
    expect(getMock).toHaveBeenCalledExactlyOnceWith(KEY);
  });

  it("should parse, validate and store the JSON value", async () => {
    getMock.mockResolvedValueOnce(JSON.stringify(VALUE));

    const result = await wrapper.get(KEY);

    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toEqual(VALUE);
  });

  it("should return ValidationError when the stored payload isn't valid JSON", async () => {
    getMock.mockResolvedValueOnce("not-json");

    const result = await wrapper.get(KEY);

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toBeInstanceOf(ValidationError);
  });

  it("should return ValidationError when the stored value doesn't match the schema", async () => {
    getMock.mockResolvedValueOnce(JSON.stringify({ id: "1" }));

    const result = await wrapper.get(KEY);

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toBeInstanceOf(ValidationError);
  });

  it("should classify connection-closed errors as ServiceUnavailableError", async () => {
    getMock.mockRejectedValueOnce(
      buildRedisError("SocketClosedUnexpectedlyError", "eof"),
    );

    const result = await wrapper.get(KEY);

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toBeInstanceOf(ServiceUnavailableError);
  });
});

describe("RedisObjectWrapper — topology", () => {
  it("accepts a single-node client and preserves its concrete type via getClient()", async () => {
    const nodeGet = vi.fn().mockResolvedValueOnce(JSON.stringify(VALUE));
    const nodeStub = {
      get: nodeGet,
      set: vi.fn(),
    } as unknown as RedisClientType;

    const nodeWrapper = new RedisObjectWrapper(nodeStub, ValueSchema);

    const back = nodeWrapper.getClient();
    expect(back).toBe(nodeStub);

    const result = await nodeWrapper.get(KEY);
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toEqual(VALUE);
    expect(nodeGet).toHaveBeenCalledExactlyOnceWith(KEY);
  });
});
