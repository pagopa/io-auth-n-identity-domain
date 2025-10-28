/* eslint-disable no-console */
import * as E from "fp-ts/Either";
import * as TE from "fp-ts/TaskEither";
import yargs from "yargs";
import { pipe } from "fp-ts/lib/function";
import { hideBin } from "yargs/helpers";
import { readableReportSimplified } from "@pagopa/ts-commons/lib/reporters";
import { Config } from "./types";

const UTILITY_NAME = "UserDataDeleteOrchestratorV2 Invoker";

console.time("Process time");
const run = async () => {
  const args = await yargs(hideBin(process.argv))
    .command(
      "inputFilePath",
      "(Optional) Input file path. Defaults to users.txt",
    )
    .command(
      "interval",
      "(Optional) Interval between orchestrator invocations in milliseconds. Defaults to 100ms",
    )
    .parse();

  const config = pipe(
    args,
    Config.decode,
    E.getOrElseW((errors) => {
      throw Error(
        `Failed to decode arguments: ${readableReportSimplified(errors)}`,
      );
    }),
  );

  return await pipe(
    TE.of(void 0),
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
