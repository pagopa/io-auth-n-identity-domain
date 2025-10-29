import { writeFileSync, readFileSync, existsSync } from "fs";
import { vi, expect, describe, it, afterEach } from "vitest";
import { FiscalCode } from "@pagopa/ts-commons/lib/strings";
import * as E from "fp-ts/Either";
import { readFiscalCodesFromFile } from "../file";

vi.mock("fs");
vi.mocked(existsSync).mockImplementation(() => true);
const mockReadFile = vi.mocked(readFileSync);
const mockWriteFile = vi.mocked(writeFileSync);

const INPUT_FILE_PATH = "input.txt";
const EMPTY_FILE_PATH = "empty.txt";
const ERROR_FILE_PATH = "errors.txt";
const ENCODING_OPTION = { encoding: "utf-8" };

const FISCAL_CODES_LIST = [
  "ISPXNB32R82Y766A",
  "ISPXNB32R82Y766B",
  "ISPXNB32R82Y766C",
  "ISPXNB32R82Y766D",
  "ISPXNB32R82Y766E",
] as FiscalCode[];
const FISCAL_CODES: ReadonlyArray<FiscalCode> = FISCAL_CODES_LIST;

const INVALID_FISCAL_CODES_LIST = ["INVALID1", "INVALID2"];

const VALID_FISCAL_CODES_FILE_CONTENT = FISCAL_CODES_LIST.join("\n");
const MIXED_FISCAL_CODES_FILE_CONTENT = [
  ...FISCAL_CODES_LIST,
  ...INVALID_FISCAL_CODES_LIST,
].join("\n");

describe("readFiscalCodesFromFile", () => {
  afterEach(() => {
    vi.clearAllMocks();
    mockReadFile.mockReset();
    mockWriteFile.mockReset();
  });

  it("should parse a file with only valid fiscal codes correctly", () => {
    mockReadFile.mockReturnValueOnce(VALID_FISCAL_CODES_FILE_CONTENT);

    const result = readFiscalCodesFromFile(INPUT_FILE_PATH, ERROR_FILE_PATH);

    expect(mockReadFile).toHaveBeenCalledExactlyOnceWith(
      INPUT_FILE_PATH,
      ENCODING_OPTION,
    );
    expect(mockWriteFile).not.toHaveBeenCalled();

    expect(E.isRight(result)).toBe(true);
    expect(result).toEqual(E.right(FISCAL_CODES));
  });

  it("should write invalid fiscal codes to a file and return only valid ones", () => {
    mockReadFile.mockReturnValueOnce(MIXED_FISCAL_CODES_FILE_CONTENT);

    const result = readFiscalCodesFromFile(INPUT_FILE_PATH, ERROR_FILE_PATH);

    expect(mockReadFile).toHaveBeenCalledExactlyOnceWith(
      INPUT_FILE_PATH,
      ENCODING_OPTION,
    );
    expect(mockWriteFile).toHaveBeenCalledWith(
      ERROR_FILE_PATH,
      INVALID_FISCAL_CODES_LIST.join("\n") + "\n",
      ENCODING_OPTION,
    );

    expect(E.isRight(result)).toBe(true);
    expect(result).toEqual(E.right(FISCAL_CODES));
  });

  it("should return an empty array for an empty file", () => {
    const mockReadFile = vi.mocked(readFileSync).mockReturnValueOnce("");
    const mockWriteFile = vi.mocked(writeFileSync);

    const result = readFiscalCodesFromFile(EMPTY_FILE_PATH, ERROR_FILE_PATH);

    expect(mockReadFile).toHaveBeenCalledExactlyOnceWith(
      EMPTY_FILE_PATH,
      ENCODING_OPTION,
    );
    expect(mockWriteFile).not.toHaveBeenCalled();

    expect(E.isRight(result)).toBe(true);
    expect(result).toEqual(E.right([]));
  });

  it("should return an error if reading the file fails", () => {
    mockReadFile.mockImplementationOnce(() => {
      throw new Error("Failed to read file");
    });

    const result = readFiscalCodesFromFile(INPUT_FILE_PATH, ERROR_FILE_PATH);

    expect(mockReadFile).toHaveBeenCalledExactlyOnceWith(
      INPUT_FILE_PATH,
      ENCODING_OPTION,
    );
    expect(mockWriteFile).not.toHaveBeenCalled();

    expect(E.isLeft(result)).toBe(true);
    if (E.isLeft(result)) {
      expect(result.left.message).toMatch(/Failed to read file/);
    }
  });

  it("should return an error if writing invalid fiscal codes fails", () => {
    mockReadFile.mockReturnValueOnce(MIXED_FISCAL_CODES_FILE_CONTENT);
    mockWriteFile.mockImplementationOnce(() => {
      throw new Error("Failed to write error file");
    });

    const result = readFiscalCodesFromFile(INPUT_FILE_PATH, ERROR_FILE_PATH);

    expect(mockReadFile).toHaveBeenCalledExactlyOnceWith(
      INPUT_FILE_PATH,
      ENCODING_OPTION,
    );
    expect(mockWriteFile).toHaveBeenCalledExactlyOnceWith(
      ERROR_FILE_PATH,
      INVALID_FISCAL_CODES_LIST.join("\n") + "\n",
      ENCODING_OPTION,
    );

    expect(E.isLeft(result)).toBe(true);
    if (E.isLeft(result)) {
      expect(result.left.message).toMatch(/Failed to write error file/);
    }
  });
});
