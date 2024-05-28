import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import * as E from "fp-ts/Either";
import { RestError } from "@azure/data-tables";
import { aFiscalCode } from "../../__mocks__/user.mocks";
import {
  getUserAuthenticationLocks,
  lockUserAuthentication,
  unlockUserAuthentication,
} from "../locked-profiles";
import {
  aNotReleasedData,
  anUnlockCode,
  anotherUnlockCode,
  brokeEntityProfileLockedRecordIterator,
  errorProfileLockedRecordIterator,
  getLockedProfileIterator,
  mockCreateEntity,
  mockListEntities,
  mockSubmitTransaction,
  mockedTableClient,
} from "../../__mocks__/repositories/table-client-mocks";

describe("LockProfileRepo#lockUserAuthentication", () => {
  beforeAll(() => {
    vi.useFakeTimers({ now: new Date(2020, 3, 1) });
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  test("should return true if CF-unlockcode has been stored sucessfully in table storage", async () => {
    const result = await lockUserAuthentication(
      aFiscalCode,
      anUnlockCode,
    )({ lockUserTableClient: mockedTableClient })();

    expect(result).toEqual(E.right(true));
    expect(mockCreateEntity).toHaveBeenCalledWith({
      partitionKey: aFiscalCode,
      rowKey: anUnlockCode,
      CreatedAt: new Date(2020, 3, 1),
    });
  });

  test("should return an Error when CF-unlockcode has already been stored in table storage", async () => {
    mockCreateEntity.mockRejectedValueOnce(
      new RestError("Conflict", { statusCode: 409 }),
    );
    const result = await lockUserAuthentication(
      aFiscalCode,
      anUnlockCode,
    )({ lockUserTableClient: mockedTableClient })();

    expect(result).toEqual(
      E.left(new Error("Something went wrong creating the record")),
    );
  });

  test("should return an Error when an error occurred while storing value in table storage", async () => {
    mockCreateEntity.mockRejectedValueOnce(
      new RestError("Another Error", { statusCode: 418 }),
    );
    const result = await lockUserAuthentication(
      aFiscalCode,
      anUnlockCode,
    )({ lockUserTableClient: mockedTableClient })();

    expect(result).toEqual(
      E.left(new Error("Something went wrong creating the record")),
    );
  });
});

describe("LockProfileRepo#unlockUserAuthentication", () => {
  test("should return true when records update transaction succeded", async () => {
    const result = await unlockUserAuthentication(aFiscalCode, [
      anUnlockCode,
      anotherUnlockCode,
    ])({ lockUserTableClient: mockedTableClient })();

    expect(result).toEqual(E.right(true));
    expect(mockSubmitTransaction).toHaveBeenCalledWith([
      [
        "update",
        {
          partitionKey: aFiscalCode,
          rowKey: anUnlockCode,
          Released: true,
        },
      ],
      [
        "update",
        {
          partitionKey: aFiscalCode,
          rowKey: anotherUnlockCode,
          Released: true,
        },
      ],
    ]);
  });

  test("should return an Error when at least one CF-unlock code was not found", async () => {
    mockSubmitTransaction.mockRejectedValueOnce(
      new RestError("Not Found", { statusCode: 404 }),
    );
    const result = await unlockUserAuthentication(aFiscalCode, [
      anUnlockCode,
      anotherUnlockCode,
    ])({ lockUserTableClient: mockedTableClient })();

    expect(result).toEqual(
      E.left(new Error("Something went wrong updating the record")),
    );
  });

  test("should return an Error when an error occurred updating the record", async () => {
    mockSubmitTransaction.mockRejectedValueOnce(
      new RestError("An Error", { statusCode: 500 }),
    );
    const result = await unlockUserAuthentication(aFiscalCode, [anUnlockCode])({
      lockUserTableClient: mockedTableClient,
    })();

    expect(result).toEqual(
      E.left(new Error("Something went wrong updating the record")),
    );
  });
});

describe("AuthenticationLockService#getUserAuthenticationLocks", () => {
  test("should return an empty array if query returns no records from table storage", async () => {
    const result = await getUserAuthenticationLocks(aFiscalCode)({
      lockUserTableClient: mockedTableClient,
    })();

    expect(result).toEqual(E.right([]));
    expect(mockListEntities).toHaveBeenCalledWith({
      queryOptions: {
        filter: `PartitionKey eq '${aFiscalCode}' and not Released`,
      },
    });
  });

  test.each`
    title             | records
    ${"one record"}   | ${[aNotReleasedData]}
    ${"more records"} | ${[aNotReleasedData, { ...aNotReleasedData, rowKey: anotherUnlockCode }]}
  `(
    "should return all the records, if $title not Released are found in table storage",
    async ({ records }) => {
      mockListEntities.mockImplementationOnce(() =>
        getLockedProfileIterator(records),
      );

      const result = await getUserAuthenticationLocks(aFiscalCode)({
        lockUserTableClient: mockedTableClient,
      })();

      expect(result).toEqual(E.right(records));
    },
  );

  test("should return an error if something went wrong retrieving the records", async () => {
    mockListEntities.mockImplementationOnce(errorProfileLockedRecordIterator);

    const result = await getUserAuthenticationLocks(aFiscalCode)({
      lockUserTableClient: mockedTableClient,
    })();

    expect(result).toEqual(E.left(Error("an Error")));
  });

  test("should return an error if something went wrong decoding a record", async () => {
    mockListEntities.mockImplementationOnce(
      brokeEntityProfileLockedRecordIterator,
    );

    const result = await getUserAuthenticationLocks(aFiscalCode)({
      lockUserTableClient: mockedTableClient,
    })();

    expect(result).toEqual(
      E.left(
        Error(
          'value ["CF"] at [root.0.partitionKey] is not a valid [string that matches the pattern "^[A-Z]{6}[0-9LMNPQRSTUV]{2}[ABCDEHLMPRST][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]$"]',
        ),
      ),
    );
  });
});
