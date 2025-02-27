import { beforeEach } from "node:test";
import { appendFileSync, readFileSync } from "fs";
import { vi, expect, describe, it, assert, afterEach } from "vitest";
import { FiscalCode } from "@pagopa/ts-commons/lib/strings";
import * as A from "fp-ts/Array";
import {
  createBatch,
  exportErrorsIntoFile,
  FIELD_SEPARATOR,
  importFileIntoBatches,
} from "../file";
import { ItemPayload, ItemToEnqueue } from "../types";

vi.mock("fs");

const fiscalCodesList = [
  "ISPXNB32R82Y766A" as FiscalCode,
  "ISPXNB32R82Y766B" as FiscalCode,
  "ISPXNB32R82Y766C" as FiscalCode,
  "ISPXNB32R82Y766D" as FiscalCode,
  "ISPXNB32R82Y766E" as FiscalCode,
];

const timestampList = [
  new Date("1970-01-01").getTime(),
  new Date("1971-01-01").getTime(),
  new Date("1972-01-01").getTime(),
  new Date("1973-01-01").getTime(),
  new Date("1974-01-01").getTime(),
  new Date("1975-01-01").getTime(),
];

const readFileSpy = vi
  .mocked(readFileSync)
  .mockReturnValue(
    A.zipWith(
      fiscalCodesList,
      timestampList,
      (fiscalCode, timestamp) => `${fiscalCode}${FIELD_SEPARATOR}${timestamp}`,
    ).join("\n"),
  );
const appendFileSpy = vi.mocked(appendFileSync);

const aTimeoutMultiplier = 20;
const aChunkLimit = 2;

const aGoodInput: ReadonlyArray<ItemPayload> = A.zipWith(
  fiscalCodesList,
  timestampList,
  (fiscalCode, expiredAt) => ({ fiscalCode, expiredAt }),
);

describe("Import batches test", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create a coerent batch", () => {
    const expectedBatch: ReadonlyArray<ReadonlyArray<ItemToEnqueue>> = [
      [
        {
          payload: aGoodInput[0],
          itemTimeoutInSeconds: aTimeoutMultiplier * 0,
        },
        {
          payload: aGoodInput[1],
          itemTimeoutInSeconds: aTimeoutMultiplier * 0,
        },
      ],
      [
        {
          payload: aGoodInput[2],
          itemTimeoutInSeconds: aTimeoutMultiplier * 1,
        },
        {
          payload: aGoodInput[3],
          itemTimeoutInSeconds: aTimeoutMultiplier * 1,
        },
      ],
      [
        {
          payload: aGoodInput[4],
          itemTimeoutInSeconds: aTimeoutMultiplier * 2,
        },
      ],
    ];

    const result = createBatch(aChunkLimit, aTimeoutMultiplier)(aGoodInput);

    expect(result).toStrictEqual(expectedBatch);
  });

  it("should parse a file correctly into batches", () => {
    const result = importFileIntoBatches(
      "foo",
      aChunkLimit,
      aTimeoutMultiplier,
    );
    const expectedResult = createBatch(
      aChunkLimit,
      aTimeoutMultiplier,
    )(aGoodInput);

    expect(readFileSpy).toHaveBeenCalled();
    expect(result).toEqual(expectedResult);
  });

  it.each`
    scenario                         | value
    ${"a wrong fiscal code"}         | ${"ABCD, 123"}
    ${"a wrong timestamp is passed"} | ${fiscalCodesList[0] + ", abc"}
  `("should throw on failed parsing when $scenario is passed", ({ value }) => {
    readFileSpy.mockReturnValueOnce(value);
    try {
      importFileIntoBatches("foo", aChunkLimit, aTimeoutMultiplier);
      assert.fail();
    } catch (err) {
      expect(readFileSpy).toHaveBeenCalled();
      assert(err instanceof Error);
      expect(err.message).toEqual(
        expect.stringContaining("at root is not a valid"),
      );
    }
  });
});

describe("Export errors to file", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should parse errors with payload as message", () => {
    const result = exportErrorsIntoFile("foo", [
      Error(JSON.stringify(aGoodInput[0])),
      Error(JSON.stringify(aGoodInput[1])),
      Error(JSON.stringify(aGoodInput[2])),
    ] as const);

    expect(appendFileSpy).toHaveBeenCalledTimes(3);
    expect(result.length).toEqual(3);
  });

  it.each`
    title                          | value
    ${"undefined value"}           | ${undefined}
    ${"null value"}                | ${null}
    ${"empty object"}              | ${{}}
    ${"wrong payload"}             | ${{ foo: "bar" }}
    ${"wrong fiscalCode"}          | ${{ fiscalCode: "ABCD" }}
    ${"partially correct payload"} | ${{ fiscalCode: fiscalCodesList[0], expiredAt: Error("foo") }}
  `("should return error when parse fails on $title", ({ value }) => {
    const result = exportErrorsIntoFile("foo", [
      Error(JSON.stringify(value)),
      Error(JSON.stringify(value)),
      Error(JSON.stringify(value)),
    ] as const);

    expect(appendFileSpy).toHaveBeenCalledTimes(0);
    expect(result.length).toEqual(3);
  });
});
