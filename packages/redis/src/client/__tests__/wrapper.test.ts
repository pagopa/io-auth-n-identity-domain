import {
  AuthenticationError,
  GatewayTimeoutError,
  GenericError,
  ServiceUnavailableError,
  ValidationError,
} from "@pagopa/hexagonal-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { type RedisClusterClient, RedisSetWrapper } from "../wrapper.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const KEY = "BLOCKEDUSERS";
const MEMBER = "ISPXNB32R82Y766D";

const MemberSchema = z.string().min(1);

const sIsMemberMock = vi.fn();
const sAddMock = vi.fn();
const sRemMock = vi.fn();

const clientStub = {
  sIsMember: sIsMemberMock,
  sAdd: sAddMock,
  sRem: sRemMock,
} as unknown as RedisClusterClient;

const wrapper = new RedisSetWrapper(clientStub, MemberSchema);

const buildRedisError = (name: string, message: string): Error => {
  const error = new Error(message);
  error.name = name;
  return error;
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// getClient
// ---------------------------------------------------------------------------

describe("RedisSetWrapper#getClient", () => {
  it("returns the underlying client (escape hatch)", () => {
    expect(wrapper.getClient()).toBe(clientStub);
  });
});

// ---------------------------------------------------------------------------
// sIsMember
// ---------------------------------------------------------------------------

describe("RedisSetWrapper#sIsMember", () => {
  it("returns ok(true) when SISMEMBER resolves true", async () => {
    sIsMemberMock.mockResolvedValueOnce(true);

    const result = await wrapper.isMember(KEY, MEMBER);

    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toBe(true);
    expect(sIsMemberMock).toHaveBeenCalledExactlyOnceWith(KEY, MEMBER);
  });

  it("returns ok(false) when SISMEMBER resolves false", async () => {
    sIsMemberMock.mockResolvedValueOnce(false);

    const result = await wrapper.isMember(KEY, MEMBER);

    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toBe(false);
  });

  it("classifies NOAUTH replies as AuthenticationError", async () => {
    sIsMemberMock.mockRejectedValueOnce(
      buildRedisError("ErrorReply", "NOAUTH Authentication required."),
    );

    const result = await wrapper.isMember(KEY, MEMBER);

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toBeInstanceOf(AuthenticationError);
  });

  it("classifies ConnectionTimeoutError as GatewayTimeoutError", async () => {
    sIsMemberMock.mockRejectedValueOnce(
      buildRedisError("ConnectionTimeoutError", "connect ETIMEDOUT"),
    );

    const result = await wrapper.isMember(KEY, MEMBER);

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toBeInstanceOf(GatewayTimeoutError);
  });

  it("classifies connection-closed errors as ServiceUnavailableError", async () => {
    sIsMemberMock.mockRejectedValueOnce(
      buildRedisError("SocketClosedUnexpectedlyError", "eof"),
    );

    const result = await wrapper.isMember(KEY, MEMBER);

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toBeInstanceOf(ServiceUnavailableError);
  });

  it("falls through to GenericError for unknown failures", async () => {
    sIsMemberMock.mockRejectedValueOnce(new Error("something odd"));

    const result = await wrapper.isMember(KEY, MEMBER);

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toBeInstanceOf(GenericError);
  });
});

// ---------------------------------------------------------------------------
// sAdd
// ---------------------------------------------------------------------------

describe("RedisSetWrapper#sAdd", () => {
  it("returns ok(1) when SADD newly adds the member", async () => {
    sAddMock.mockResolvedValueOnce(1);

    const result = await wrapper.add(KEY, MEMBER);

    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toBe(1);
    expect(sAddMock).toHaveBeenCalledExactlyOnceWith(KEY, MEMBER);
  });

  it("returns ok(0) when SADD reports the member was already present", async () => {
    sAddMock.mockResolvedValueOnce(0);

    const result = await wrapper.add(KEY, MEMBER);

    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toBe(0);
  });

  it("returns a classified RedisError when SADD rejects", async () => {
    sAddMock.mockRejectedValueOnce(
      buildRedisError(
        "ErrorReply",
        "WRONGTYPE Operation against a key holding the wrong kind of value",
      ),
    );

    const result = await wrapper.add(KEY, MEMBER);

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toBeInstanceOf(GenericError);
    expect(result._unsafeUnwrapErr().message).toContain("WRONGTYPE");
  });
});

// ---------------------------------------------------------------------------
// sRem
// ---------------------------------------------------------------------------

describe("RedisSetWrapper#sRem", () => {
  it("returns ok(1) when SREM removes the member", async () => {
    sRemMock.mockResolvedValueOnce(1);

    const result = await wrapper.rem(KEY, MEMBER);

    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toBe(1);
    expect(sRemMock).toHaveBeenCalledExactlyOnceWith(KEY, MEMBER);
  });

  it("returns ok(0) when SREM reports the member was not present", async () => {
    sRemMock.mockResolvedValueOnce(0);

    const result = await wrapper.rem(KEY, MEMBER);

    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toBe(0);
  });

  it("returns a classified RedisError when SREM rejects", async () => {
    sRemMock.mockRejectedValueOnce(
      buildRedisError("ClientClosedError", "closed"),
    );

    const result = await wrapper.rem(KEY, MEMBER);

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toBeInstanceOf(ServiceUnavailableError);
  });
});

// ---------------------------------------------------------------------------
// Schema validation short-circuits
// ---------------------------------------------------------------------------

describe("RedisSetWrapper — schema validation", () => {
  // A schema that only accepts the exact literal string "VALID". Anything
  // else short-circuits with a ValidationError, and no server round-trip
  // is made.
  const StrictSchema = z.literal("VALID");
  const strictWrapper = new RedisSetWrapper(clientStub, StrictSchema);

  it("isMember short-circuits with ValidationError when the schema rejects", async () => {
    const result = await strictWrapper.isMember(KEY, "NOT-VALID" as "VALID");

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toBeInstanceOf(ValidationError);
    expect(sIsMemberMock).not.toHaveBeenCalled();
  });

  it("add short-circuits with ValidationError for a single invalid member", async () => {
    const result = await strictWrapper.add(KEY, "NOT-VALID" as "VALID");

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toBeInstanceOf(ValidationError);
    expect(sAddMock).not.toHaveBeenCalled();
  });

  it("add short-circuits with ValidationError on the first invalid entry of an array", async () => {
    const result = await strictWrapper.add(KEY, [
      "VALID",
      "NOT-VALID" as "VALID",
      "VALID",
    ]);

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toBeInstanceOf(ValidationError);
    // Nothing must reach Redis when even one member is invalid.
    expect(sAddMock).not.toHaveBeenCalled();
  });

  it("rem short-circuits with ValidationError for an invalid member", async () => {
    const result = await strictWrapper.rem(KEY, "NOT-VALID" as "VALID");

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toBeInstanceOf(ValidationError);
    expect(sRemMock).not.toHaveBeenCalled();
  });

  it("forwards a single validated member as a string to sAdd", async () => {
    sAddMock.mockResolvedValueOnce(1);

    await strictWrapper.add(KEY, "VALID");

    expect(sAddMock).toHaveBeenCalledExactlyOnceWith(KEY, "VALID");
  });

  it("forwards a validated array as string[] to sAdd", async () => {
    sAddMock.mockResolvedValueOnce(2);

    await strictWrapper.add(KEY, ["VALID", "VALID"]);

    expect(sAddMock).toHaveBeenCalledExactlyOnceWith(KEY, ["VALID", "VALID"]);
  });
});
