import fs from "fs";
import * as TE from "fp-ts/TaskEither";
import * as RTE from "fp-ts/ReaderTaskEither";
import { pipe } from "fp-ts/function";
import { FiscalCode } from "@pagopa/ts-commons/lib/strings";
import { Config } from "./types";

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
): TE.TaskEither<Error, void> =>
  TE.tryCatch(
    () =>
      fs.promises.appendFile(filePath, `${fiscalCode}: ${error.message}\n`, {
        encoding: "utf-8",
      }),
    (reason) => new Error(`Failed to write error log: ${String(reason)}`),
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
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res;
          }),
    (reason) => new Error(`Failed to PUT ${url}: ${String(reason)}`),
  );

/**
 * Processes a single fiscal code by invoking the remote API.
 * On failure, logs the error into `errorsFiscalCodesFilePath` and continues.
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
          TE.chain(() => TE.left(err)),
        ),
      ),
    );
