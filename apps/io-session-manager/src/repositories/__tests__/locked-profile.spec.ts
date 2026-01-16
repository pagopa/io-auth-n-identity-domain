import { describe, expect, test } from "vitest";
import * as E from "fp-ts/Either";
import { aFiscalCode } from "../../__mocks__/user.mocks";
import { getUserAuthenticationLocks } from "../locked-profiles";
import {
  aNotReleasedData,
  anotherUnlockCode,
  brokeEntityProfileLockedRecordIterator,
  errorProfileLockedRecordIterator,
  getLockedProfileIterator,
  mockListEntities,
  mockedTableClient,
} from "../../__mocks__/repositories/table-client-mocks";

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
