import fs from "fs";
import * as ROA from "fp-ts/ReadonlyArray";
import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/function";
import { FiscalCode } from "@pagopa/ts-commons/lib/strings";
import { Separated } from "fp-ts/lib/Separated";
import { InvalidFiscalCodeError, toInvalidFiscalCodeError } from "./errors";

/**
 * Reads a text file and returns a readonly array of non-empty trimmed lines.
 * @param filename The path to the input file.
 * @returns Either an Error if reading fails, or a readonly array of lines.
 */
const readLinesFromFile = (
  filename: string,
): E.Either<Error, ReadonlyArray<string>> =>
  E.tryCatch(
    () =>
      fs
        .readFileSync(filename, { encoding: "utf-8" })
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0),
    (reason) => new Error(`Failed to read file: ${reason}`),
  );

/**
 * Attempts to decode a line as a FiscalCode.
 * @param line The input string to validate.
 * @returns Either an InvalidFiscalCodeError if invalid, or the decoded FiscalCode.
 */
const lineToFiscalCode = (
  line: string,
): E.Either<InvalidFiscalCodeError, FiscalCode> =>
  pipe(
    FiscalCode.decode(line),
    E.mapLeft(() => toInvalidFiscalCodeError(line)),
  );

/**
 * Splits an array of lines into valid fiscal codes and invalid errors.
 * @param lines The array of input strings.
 * @returns A Separated containing invalid fiscal code errors (left) and valid fiscal codes (right).
 */
const linesToFiscalCodes = (
  lines: ReadonlyArray<string>,
): Separated<
  ReadonlyArray<InvalidFiscalCodeError>,
  ReadonlyArray<FiscalCode>
> => pipe(lines, ROA.map(lineToFiscalCode), ROA.separate);

/**
 * Writes invalid fiscal codes to a file.
 * @param errors The array of InvalidFiscalCodeError objects.
 * @param errorFilePath The path to the error output file.
 * @returns Either an Error if writing fails, or void on success.
 */
const writeInvalidFiscalCodes = (
  errors: ReadonlyArray<InvalidFiscalCodeError>,
  errorFilePath: string,
): E.Either<Error, void> =>
  E.tryCatch(
    () => {
      const fiscalCodes = pipe(
        errors,
        ROA.map((e) => e.fiscalCode),
      );
      fs.writeFileSync(errorFilePath, fiscalCodes.join("\n") + "\n", {
        encoding: "utf-8",
      });
      // eslint-disable-next-line no-console
      console.warn(
        `Wrote ${fiscalCodes.length} invalid fiscal codes to ${errorFilePath}`,
      );
    },
    (reason) => new Error(`Failed to write error file: ${reason}`),
  );

/**
 * Writes invalid fiscal codes to a file only if there are any.
 * @param errors The array of InvalidFiscalCodeError objects.
 * @param errorFilePath The path to the error output file.
 * @returns Either an Error if writing fails, or void on success.
 */
const writeInvalidFiscalCodesIfAny = (
  errors: ReadonlyArray<InvalidFiscalCodeError>,
  errorFilePath: string,
): E.Either<Error, void> =>
  ROA.isEmpty(errors)
    ? E.right(void 0)
    : writeInvalidFiscalCodes(errors, errorFilePath);

/**
 * Reads fiscal codes from a file, validates them, and returns only the valid ones.
 *
 * Steps:
 * 1. Reads all non-empty, trimmed lines from the input file.
 * 2. Validates each line as a FiscalCode.
 * 3. Writes invalid fiscal codes to a separate error file.
 * 4. Returns only the valid fiscal codes.
 *
 * @param inputFilePath Path to the input file containing fiscal codes (one per line).
 * @param errorFilePath Path to the output file where invalid fiscal codes will be written.
 * @returns Either an Error if reading or writing fails, or a readonly array of valid FiscalCodes.
 */
export const readFiscalCodesFromFile = (
  inputFilePath: string,
  errorFilePath: string,
): E.Either<Error, ReadonlyArray<FiscalCode>> =>
  pipe(
    readLinesFromFile(inputFilePath),
    E.map(linesToFiscalCodes),
    E.chain((separated) =>
      pipe(
        writeInvalidFiscalCodesIfAny(separated.left, errorFilePath),
        E.map(() => separated.right),
      ),
    ),
  );
