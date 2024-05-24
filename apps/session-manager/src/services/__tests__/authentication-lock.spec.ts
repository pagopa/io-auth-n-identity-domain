import { describe, test, expect, vi, afterEach } from "vitest";
import { pipe } from "fp-ts/lib/function";
import * as E from "fp-ts/Either";
import { TableEntityResultPage } from "@azure/data-tables";
import { FiscalCode } from "@pagopa/ts-commons/lib/strings";
import {
  getLockedProfileIterator,
  mockListEntities,
  mockedTableClient,
} from "../../__mocks__/repositories/table-client-mocks";
import { aFiscalCode } from "../../__mocks__/user.mocks";
import { NotReleasedAuthenticationLockData } from "../../repositories/locked-profile";
import { isUserAuthenticationLocked } from "../authentication-lock";
import { UnlockCode } from "../../generated/fast-login-api/UnlockCode";

describe("AuthLockService#isUserAuthenticationLocked", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  const mockedDependencies = { lockUserTableClient: mockedTableClient };

  test("should return true if the user has active locks", async () => {
    const expectedResults = [
      {
        etag: "a",
        partitionKey: aFiscalCode,
        rowKey: "001122330" as UnlockCode,
        CreatedAt: new Date(),
      },
      {
        etag: "a",
        partitionKey: aFiscalCode,
        rowKey: "001122999" as UnlockCode,
        CreatedAt: new Date(),
      },
    ] as TableEntityResultPage<NotReleasedAuthenticationLockData>;
    mockListEntities.mockImplementation(() =>
      getLockedProfileIterator(expectedResults),
    );

    const result = await pipe(
      mockedDependencies,
      isUserAuthenticationLocked(aFiscalCode),
    )();

    expect(mockListEntities).toBeCalled();
    expect(result).toEqual(E.right(true));
  });

  test("should return false if the user don't has active locks", async () => {
    mockListEntities.mockImplementation(() => getLockedProfileIterator([]));

    const result = await pipe(
      mockedDependencies,
      isUserAuthenticationLocked(aFiscalCode),
    )();

    expect(mockListEntities).toBeCalled();
    expect(result).toEqual(E.right(false));
  });

  test("should return an error if a decode error occurs reading from the storage", async () => {
    mockListEntities.mockImplementation(() =>
      getLockedProfileIterator([
        {
          partitionKey: "anInvalidFiscalCode" as FiscalCode,
          rowKey: "001122330" as UnlockCode,
          CreatedAt: new Date().toISOString() as unknown as Date,
        },
      ]),
    );

    const result = await pipe(
      mockedDependencies,
      isUserAuthenticationLocked(aFiscalCode),
    )();

    expect(mockListEntities).toBeCalled();
    expect(E.isLeft(result)).toBeTruthy();
  });
});
