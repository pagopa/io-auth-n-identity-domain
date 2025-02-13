import { beforeEach } from "node:test";
import { readFileSync } from "fs";
import { vi, expect, describe, it, assert } from "vitest";
import { FiscalCode } from "@pagopa/ts-commons/lib/strings";
import { createBatch, importFileIntoBatches } from "../file";

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
