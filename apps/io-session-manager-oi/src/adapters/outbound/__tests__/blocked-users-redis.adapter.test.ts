import {
  FiscalCode,
  FiscalCodeSchema,
  GenericError,
} from "@pagopa/hexagonal-core";
import { RedisNodeClient, RedisSetWrapper } from "@pagopa/redis/client";
import { err, ok } from "neverthrow";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  BLOCKED_USERS_SET_KEY,
  BlockedUsersRedisAdapter,
} from "../blocked-users-redis.adapter.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const FISCAL_CODE = FiscalCodeSchema.parse("ISPXNB32R82Y766D");

const isMemberMock = vi.fn();
const pingMock = vi.fn();
const getClientMock = vi.fn(() => ({ ping: pingMock }));

const wrapperStub = {
  isMember: isMemberMock,
  getClient: getClientMock,
} as unknown as RedisSetWrapper<typeof FiscalCodeSchema, RedisNodeClient>;

const adapter = new BlockedUsersRedisAdapter(wrapperStub);

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// isBlocked
// ---------------------------------------------------------------------------

describe("BlockedUsersRedisAdapter#isBlocked", () => {
  it("returns ok(true) when SISMEMBER reports membership", async () => {
    isMemberMock.mockResolvedValueOnce(ok(true));

    const result = await adapter.isBlocked(FISCAL_CODE);

    expect(isMemberMock).toHaveBeenCalledExactlyOnceWith(
      BLOCKED_USERS_SET_KEY,
      FISCAL_CODE,
    );
    expect(result).toEqual(ok(true));
  });

  it("returns ok(false) when SISMEMBER reports non-membership", async () => {
    isMemberMock.mockResolvedValueOnce(ok(false));

    const result = await adapter.isBlocked(FISCAL_CODE);

    expect(isMemberMock).toHaveBeenCalledExactlyOnceWith(
      BLOCKED_USERS_SET_KEY,
      FISCAL_CODE,
    );
    expect(result).toEqual(ok(false));
  });

  it("forwards the wrapper's classified error unchanged", async () => {
    const wrapperError = new GenericError("SISMEMBER failed");
    isMemberMock.mockResolvedValueOnce(err(wrapperError));

    const result = await adapter.isBlocked(FISCAL_CODE);

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toBe(wrapperError);
  });
});

// ---------------------------------------------------------------------------
// healthcheck
// ---------------------------------------------------------------------------

describe("BlockedUsersRedisAdapter#healthcheck", () => {
  it("returns ok(undefined) when PING replies PONG", async () => {
    pingMock.mockResolvedValueOnce("PONG");

    const result = await adapter.healthcheck();

    expect(pingMock).toHaveBeenCalledExactlyOnceWith();
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
