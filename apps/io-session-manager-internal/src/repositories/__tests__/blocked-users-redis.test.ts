import { describe, expect, it } from "vitest";
import * as E from "fp-ts/lib/Either";

import { FiscalCode } from "@pagopa/ts-commons/lib/strings";

import { BlockedUsersRedisRepository } from "../blocked-users-redis";

import {
  mockRedisClient,
  mockSadd,
  mockSrem,
} from "../../__mocks__/repositories/redis.mock";

export const aFiscalCode = "AAAAAA89S20I111X" as FiscalCode;

const deps = {
  fastClient: mockRedisClient,
};

describe("BlockedUsersRedisRepository#setBlockedUser", () => {
  it("should return E.right(true) if the user is correctly locked", async () => {
    mockSadd.mockImplementationOnce((_, __) => Promise.resolve(1));

    const result =
      await BlockedUsersRedisRepository.setBlockedUser(aFiscalCode)(deps)();

    expect(result).toEqual(E.right(true));
  });

  it("should return left if there is an error locking the user", async () => {
    const aError = new Error("any error");
    mockSadd.mockImplementationOnce((_, __) => Promise.reject(aError));

    const result =
      await BlockedUsersRedisRepository.setBlockedUser(aFiscalCode)(deps)();

    expect(result).toEqual(E.left(aError));
  });
});

describe("BlockedUsersRedisRepository#unsetBlockedUser", () => {
  it("should return E.right(true) if the user is correctly unlocked", async () => {
    mockSrem.mockImplementationOnce((_, __) => Promise.resolve(1));

    const result =
      await BlockedUsersRedisRepository.unsetBlockedUser(aFiscalCode)(deps)();

    expect(result).toEqual(E.right(true));
  });

  it("should return E.left(Error) if the user is not correctly unlocked", async () => {
    const sremFailure = 0;
    mockSrem.mockImplementationOnce((_, __) => Promise.resolve(sremFailure));

    const result =
      await BlockedUsersRedisRepository.unsetBlockedUser(aFiscalCode)(deps)();

    expect(result).toEqual(
      E.left(
        Error("Unexpected response from redis client deleting blockedUserKey"),
      ),
    );
  });
});
