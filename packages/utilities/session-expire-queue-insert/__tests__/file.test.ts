import { beforeEach } from "node:test";
import { appendFileSync, readFileSync } from "fs";
import { vi, expect, describe, it, assert, afterEach } from "vitest";
import { FiscalCode } from "@pagopa/ts-commons/lib/strings";
import {
  createBatch,
  exportErrorsIntoFile,
  importFileIntoBatches,
} from "../file";

vi.mock("fs");

const fiscalCodesList = [
  "ISPXNB32R82Y766A" as FiscalCode,
  "ISPXNB32R82Y766B" as FiscalCode,
  "ISPXNB32R82Y766C" as FiscalCode,
  "ISPXNB32R82Y766D" as FiscalCode,
  "ISPXNB32R82Y766E" as FiscalCode,
] as const;
const readFileSpy = vi
  .mocked(readFileSync)
  .mockReturnValue(fiscalCodesList.join("\n"));
const appendFileSpy = vi.mocked(appendFileSync);

const aTimeoutMultiplier = 20;
const aChunkLimit = 2;

describe("Import batches test", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    )(fiscalCodesList);

    expect(readFileSpy).toHaveBeenCalled();
    expect(result).toEqual(expectedResult);
  });

  it("should throw on failed parsing", () => {
    const aWrongFiscalCode = "ABCDE";
    readFileSpy.mockReturnValueOnce(aWrongFiscalCode);
    try {
      importFileIntoBatches("foo", aChunkLimit, aTimeoutMultiplier);
      assert.fail();
    } catch (err) {
      expect(readFileSpy).toHaveBeenCalled();
      assert(err instanceof Error);
      expect(err.message).toEqual(
        expect.stringContaining(
          `value "${aWrongFiscalCode}" at root is not a valid`,
        ),
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
      Error(JSON.stringify({ fiscalCode: fiscalCodesList[0] })),
      Error(JSON.stringify({ fiscalCode: fiscalCodesList[1] })),
      Error(JSON.stringify({ fiscalCode: fiscalCodesList[2] })),
    ] as const);

    expect(appendFileSpy).toHaveBeenCalledTimes(3);
    expect(result.length).toEqual(3);
  });

  it.each`
    title                 | value
    ${"undefined value"}  | ${undefined}
    ${"null value"}       | ${null}
    ${"empty object"}     | ${{}}
    ${"wrong payload"}    | ${{ foo: "bar" }}
    ${"wrong fiscalCode"} | ${{ fiscalCode: "ABCD" }}
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
