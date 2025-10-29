/* eslint-disable no-console */
import * as E from "fp-ts/Either";
import * as RA from "fp-ts/ReadonlyArray";
import * as TE from "fp-ts/TaskEither";
import yargs from "yargs";
import { pipe } from "fp-ts/lib/function";
import { hideBin } from "yargs/helpers";
import { readableReportSimplified } from "@pagopa/ts-commons/lib/reporters";
import { CliParams, Config } from "./types";
import { getConfigOrThrow } from "./env";
import { readFiscalCodesFromFile } from "./file";
import { ProcessFiscalCode } from "./invoker";

const UTILITY_NAME = "UserDataProcessing Invoker";

console.time("Process time");
const run = async () => {
  const args = await yargs(hideBin(process.argv))
    .command(
      "inputFilePath",
      "(Optional) Input file path. Defaults to users.txt",
    )
    .command(
      "invalidFiscalCodesFilePath",
      "(Optional) Invalid fiscal codes file path. Defaults to invalid_fiscal_codes.txt",
    )
    .command(
      "errorsFiscalCodesFilePath",
      "(Optional) Fiscal codes processed with errors file path. Defaults to errors_fiscal_codes.txt",
    )
    .parse();

  const envConfig = getConfigOrThrow();
  const cliParams = pipe(
    args,
    CliParams.decode,
    E.getOrElseW((errors) => {
      throw Error(
        `Failed to decode CLI arguments: ${readableReportSimplified(errors)}`,
      );
    }),
  );

  // Merge env and cli configs
  const config = pipe(
    { ...envConfig, ...cliParams },
    Config.decode,
    // This should never happen
    E.getOrElseW((errors) => {
      throw new Error(
        `Invalid configuration: ${readableReportSimplified(errors)}`,
      );
    }),
  );

  return await pipe(
    readFiscalCodesFromFile(
      config.inputFilePath,
      config.invalidFiscalCodesFilePath,
    ),
    TE.fromEither,
    TE.mapLeft((err) => {
      throw err;
    }),
    TE.chain((fiscalCodes) =>
      pipe(
        fiscalCodes,
        RA.traverse(TE.ApplicativeSeq)((fc) => ProcessFiscalCode(fc)(config)),
      ),
    ),
    TE.map(() => {
      console.info(`SUCCESS | ${UTILITY_NAME} | Done.`);
    }),
  )();
};

run()
  .then(() => {
    console.info("PROCESSING FINISHED");
    console.timeEnd("Process time");
    process.exit(0);
  })
  .catch((err) => {
    console.error(`ERROR | ${UTILITY_NAME} | ${err.message}`);
    process.exit(1);
  });
