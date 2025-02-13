import { beforeEach } from "node:test";
import { readFileSync } from "fs";
import { vi, expect, describe, it, assert } from "vitest";
import { FiscalCode } from "@pagopa/ts-commons/lib/strings";
import { pipe } from "fp-ts/lib/function";
import * as ROA from "fp-ts/ReadonlyArray";
import { importFileIntoBatches } from "../file";
import { ItemToEnqueue } from "../types";

vi.mock("fs");

const fiscalCodesList = [
  "ISPXNB32R82Y766A",
  "ISPXNB32R82Y766B",
  "ISPXNB32R82Y766C",
  "ISPXNB32R82Y766D",
  "ISPXNB32R82Y766E",
];
const readFileSpy = vi
  .mocked(readFileSync)
  .mockReturnValue(fiscalCodesList.join("\n"));

const aTimeoutMultiplier = 20;
const aChunkLimit = 2;
const createItem = (
  fiscalCode: string,
  itemTimeoutInSeconds: number,
): ItemToEnqueue => ({
  payload: { fiscalCode: fiscalCode as FiscalCode },
  itemTimeoutInSeconds,
});

const createBatch = (list: ReadonlyArray<string>) =>
  pipe(
    list,
    ROA.chunksOf(aChunkLimit),
    ROA.mapWithIndex((chunkNumber, chunk) =>
      pipe(
        chunk,
        ROA.map((fiscalCode) =>
          createItem(fiscalCode, aTimeoutMultiplier * chunkNumber),
        ),
      ),
    ),
  );

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
    const expectedResult = createBatch(fiscalCodesList);

    expect(readFileSpy).toHaveBeenCalled();
    expect(result).toEqual(expectedResult);
  });

  it("should throw on failed parsing", () => {
    const aWrongFiscalCode = "ABCDE";
    readFileSpy.mockReturnValueOnce(aWrongFiscalCode);
    try {
      importFileIntoBatches("foo", aChunkLimit, aTimeoutMultiplier);
      expect(true).toEqual(false);
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
