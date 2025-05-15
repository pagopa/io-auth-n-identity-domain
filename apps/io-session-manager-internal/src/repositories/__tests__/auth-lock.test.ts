import {
  describe,
  expect,
  vi,
  beforeEach,
  it,
  beforeAll,
  afterAll,
} from "vitest";
import * as E from "fp-ts/Either";
import { RestError, TableEntityResultPage } from "@azure/data-tables";
import { FiscalCode } from "@pagopa/ts-commons/lib/strings";
import {
  aNotReleasedData,
  brokeEntityProfileLockedRecordIterator,
  errorProfileLockedRecordIterator,
  getLockedProfileIterator,
  mockCreateEntity,
  mockListEntities,
  mockSubmitTransaction,
  mockTableClient,
} from "../../__mocks__/table-client.mock";
import {
  aFiscalCode,
  anUnlockCode,
  anotherUnlockCode,
} from "../../__mocks__/user.mock";
import {
  NotReleasedAuthenticationLockData,
  AuthLockRepository,
} from "../auth-lock";
import { UnlockCode } from "../../generated/definitions/internal/UnlockCode";

const mockedDependencies = { AuthenticationLockTableClient: mockTableClient };
describe("Session lock repository#isUserAuthenticationLocked", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return true if the user has active locks", async () => {
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
    mockListEntities.mockImplementationOnce(() =>
      getLockedProfileIterator(expectedResults),
    );

    const result =
      await AuthLockRepository.isUserAuthenticationLocked(aFiscalCode)(
        mockedDependencies,
      )();

    expect(mockListEntities).toBeCalled();
    expect(result).toEqual(E.right(true));
  });

  it("should return false if the user don't has active locks", async () => {
    mockListEntities.mockImplementationOnce(() => getLockedProfileIterator([]));

    const result =
      await AuthLockRepository.isUserAuthenticationLocked(aFiscalCode)(
        mockedDependencies,
      )();

    expect(mockListEntities).toBeCalled();
    expect(result).toEqual(E.right(false));
  });

  it("should return an error if a decode error occurs reading from the storage", async () => {
    mockListEntities.mockImplementationOnce(() =>
      getLockedProfileIterator([
        {
          partitionKey: "anInvalidFiscalCode" as FiscalCode,
          rowKey: "001122330" as UnlockCode,
          CreatedAt: new Date().toISOString() as unknown as Date,
        },
      ]),
    );

    const result =
      await AuthLockRepository.isUserAuthenticationLocked(aFiscalCode)(
        mockedDependencies,
      )();

    expect(mockListEntities).toBeCalled();
    expect(E.isLeft(result)).toBeTruthy();
  });
});

describe("LockProfileRepo#lockUserAuthentication", () => {
  beforeAll(() => {
    vi.useFakeTimers({ now: new Date(2020, 3, 1) });
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  it("should return true if CF-unlockcode has been stored sucessfully in table storage", async () => {
    const result = await AuthLockRepository.lockUserAuthentication(
      aFiscalCode,
      anUnlockCode,
    )(mockedDependencies)();

    expect(result).toEqual(E.right(true));
    expect(mockCreateEntity).toHaveBeenCalledWith({
      partitionKey: aFiscalCode,
      rowKey: anUnlockCode,
      CreatedAt: new Date(2020, 3, 1),
    });
  });

  it("should return an Error when CF-unlockcode has already been stored in table storage", async () => {
    mockCreateEntity.mockRejectedValueOnce(
      new RestError("Conflict", { statusCode: 409 }),
    );
    const result = await AuthLockRepository.lockUserAuthentication(
      aFiscalCode,
      anUnlockCode,
    )(mockedDependencies)();

    expect(result).toEqual(
      E.left(new Error("Something went wrong creating the record")),
    );
  });

  it("should return an Error when an error occurred while storing value in table storage", async () => {
    mockCreateEntity.mockRejectedValueOnce(
      new RestError("Another Error", { statusCode: 418 }),
    );
    const result = await AuthLockRepository.lockUserAuthentication(
      aFiscalCode,
      anUnlockCode,
    )(mockedDependencies)();

    expect(result).toEqual(
      E.left(new Error("Something went wrong creating the record")),
    );
  });
});

describe("AuthenticationLockService#getUserAuthenticationLocks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return an empty array if query returns no records from table storage", async () => {
    const result =
      await AuthLockRepository.getUserAuthenticationLocks(aFiscalCode)(
        mockedDependencies,
      )();

    expect(result).toEqual(E.right([]));
    expect(mockListEntities).toHaveBeenCalledWith({
      queryOptions: {
        filter: `PartitionKey eq '${aFiscalCode}' and not Released`,
      },
    });
  });

  it.each`
    title             | records
    ${"one record"}   | ${[aNotReleasedData]}
    ${"more records"} | ${[aNotReleasedData, { ...aNotReleasedData, rowKey: anotherUnlockCode }]}
  `(
    "should return all the records, if $title not Released are found in table storage",
    async ({ records }) => {
      mockListEntities.mockImplementationOnce(() =>
        getLockedProfileIterator(records),
      );

      const result =
        await AuthLockRepository.getUserAuthenticationLocks(aFiscalCode)(
          mockedDependencies,
        )();

      expect(result).toEqual(E.right(records));
    },
  );

  it("should return an error if something went wrong retrieving the records", async () => {
    mockListEntities.mockImplementationOnce(errorProfileLockedRecordIterator);

    const result =
      await AuthLockRepository.getUserAuthenticationLocks(aFiscalCode)(
        mockedDependencies,
      )();

    expect(result).toEqual(E.left(Error("an Error")));
  });

  it("should return an error if something went wrong decoding a record", async () => {
    mockListEntities.mockImplementationOnce(
      brokeEntityProfileLockedRecordIterator,
    );

    const result =
      await AuthLockRepository.getUserAuthenticationLocks(aFiscalCode)(
        mockedDependencies,
      )();

    expect(result).toEqual(
      E.left(
        Error(
          'value "CF" at root[0].partitionKey is not a valid [string that matches the pattern "^[A-Z]{6}[0-9LMNPQRSTUV]{2}[ABCDEHLMPRST][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]$"]',
        ),
      ),
    );
  });
});

describe("LockProfileRepo#unlockUserAuthentication", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return true when records update transaction succeded", async () => {
    const result = await AuthLockRepository.unlockUserAuthentication(
      aFiscalCode,
      [anUnlockCode, anotherUnlockCode],
    )(mockedDependencies)();

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

  it("should return an Error when at least one CF-unlock code was not found", async () => {
    mockSubmitTransaction.mockRejectedValueOnce(
      new RestError("Not Found", { statusCode: 404 }),
    );
    const result = await AuthLockRepository.unlockUserAuthentication(
      aFiscalCode,
      [anUnlockCode, anotherUnlockCode],
    )(mockedDependencies)();

    expect(result).toEqual(
      E.left(new Error("Something went wrong updating the record")),
    );
  });

  it("should return an Error when an error occurred updating the record", async () => {
    mockSubmitTransaction.mockRejectedValueOnce(
      new RestError("An Error", { statusCode: 500 }),
    );
    const result = await AuthLockRepository.unlockUserAuthentication(
      aFiscalCode,
      [anUnlockCode],
    )(mockedDependencies)();

    expect(result).toEqual(
      E.left(new Error("Something went wrong updating the record")),
    );
  });
});
