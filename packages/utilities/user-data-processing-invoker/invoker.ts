import fs from "fs";
import * as E from "fp-ts/Either";
import * as TE from "fp-ts/TaskEither";
import * as RTE from "fp-ts/ReaderTaskEither";
import { pipe } from "fp-ts/function";
import { FiscalCode } from "@pagopa/ts-commons/lib/strings";
import { Config } from "./types";
import { getErrorMessage } from "./utils";

/**
 * Writes a fiscal code and its error message to the error file.
 *
 * @param filePath The path to the error output file.
 * @param fiscalCode The fiscal code that caused the error.
 * @param error The error encountered during processing.
 * @returns A TaskEither that resolves to void or an Error.
 */
const writeErrorToFile = (
  filePath: string,
  fiscalCode: FiscalCode,
  error: Error,
): E.Either<Error, void> =>
  E.tryCatch(
    () => {
      fs.appendFileSync(filePath, `${fiscalCode}: ${error.message}\n`, "utf-8");
    },
    (error) => new Error(`Failed to write to file: ${getErrorMessage(error)}`),
  );

/**
 * Performs the PUT call to the given URL with the provided API key.
 *
 * @param url The URL to invoke.
 * @param apiKey The API key for authentication.
 * @returns A TaskEither that resolves to the Response or an Error.
 */
const put = (
  url: string,
  apiKey: string,
  dryRun: boolean,
): TE.TaskEither<Error, Response> =>
  TE.tryCatch(
    () =>
      dryRun
        ? // eslint-disable-next-line no-console
          (console.info(`[DRY RUN] PUT ${url}`),
          Promise.resolve(new Response(`DRY RUN: ${url}`, { status: 200 })))
        : fetch(url, {
            method: "PUT",
            headers: { "x-functions-key": apiKey },
          }).then((res) => {
            if (res.ok !== true)
              throw new Error(`HTTP ${res.status} ${res.statusText}`);
            return res;
          }),
    (error) => new Error(`Failed HTTP PUT '${url}': ${getErrorMessage(error)}`),
  );

/**
 * Processes a single fiscal code by invoking the remote API.
 * On failure, logs the error into `errorsFiscalCodesFilePath` and returns a Left.
 * If the write to the error file fails, then returns an error combining both errors.
 *
 * @param fiscalCode The fiscal code to process.
 * @returns A ReaderTaskEither that takes Config and returns either an Error or Response.
 */
export const ProcessFiscalCode =
  (fiscalCode: FiscalCode): RTE.ReaderTaskEither<Config, Error, Response> =>
  ({ apiUrl, apiKey, errorsFiscalCodesFilePath, dryRun }) =>
    pipe(
      apiUrl.replace("{fiscalCode}", fiscalCode),
      (url) => put(url, apiKey, dryRun),
      TE.orElse((err) =>
        pipe(
          writeErrorToFile(errorsFiscalCodesFilePath, fiscalCode, err),
          TE.fromEither,
          TE.fold(
            (writeErr) =>
              TE.left(
                new Error(
                  `Error while writing to file: ${writeErr.message} | Original error: ${err.message}`,
                ),
              ),
            () => TE.left(err),
          ),
        ),
      ),
    );
