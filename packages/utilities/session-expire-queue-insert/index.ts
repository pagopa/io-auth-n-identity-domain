/* eslint-disable no-console */
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import * as TE from "fp-ts/TaskEither";
import * as T from "fp-ts/Task";
import { initAppInsights } from "@pagopa/ts-commons/lib/appinsights";
import { pipe } from "fp-ts/function";
import * as E from "fp-ts/Either";
import * as ROA from "fp-ts/ReadonlyArray";
import { readableReportSimplified } from "@pagopa/ts-commons/lib/reporters";
import { insertBatchIntoQueue } from "../src/queue-insert";
import { Config } from "./types";
import { exportErrorsIntoFile, importFileIntoBatches } from "./file";

console.time("Process time");
const run = async () => {
  const args = await yargs(hideBin(process.argv))
    .command("storageConnString", "Connection string to storage account")
    .command("queueName", "Queue name")
    .command(
      "applicationInsightsConnString",
      "Connection string to application insights for events tracing",
    )
    .command(
      "timeoutMultiplier",
      "Decides what multiplier to apply to timeout (in seconds)",
    )
    .command(
      "singleBatchCount",
      "Decides the number of items needed to count as a batch",
    )
    .command(
      "inputFilePath",
      "(Optional) Input file path. Defaults to users.txt",
    )
    .command(
      "errorFilePath",
      "(Optional) Error file path. Defaults to errors.txt",
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

  const appInsightsTelemetryClient = initAppInsights(
    config.applicationInsightsConnString,
  );

  return await pipe(
    importFileIntoBatches(
      config.inputFilePath,
      config.singleBatchCount,
      config.timeoutMultiplier,
    ),
    ROA.mapWithIndex((index, batch) =>
      pipe(
        insertBatchIntoQueue({
          connectionString: config.storageConnString,
          queueName: config.queueName,
          appInsightsTelemetryClient,
          batch,
          errorFilePath: config.errorFilePath,
        }),
        TE.chainFirstW(() => {
          console.info(`COMPLETED BATCH ${index + 1}`);
          return TE.right(void 0);
        }),
        TE.mapLeft((errors) => {
          exportErrorsIntoFile(config.errorFilePath, errors);
          return errors;
        }),
      ),
    ),
    // NOTE: continue regardless of errors
    ROA.sequence(T.ApplicativeSeq),
  )();
};

run()
  .then(() => {
    console.info("PROCESSING FINISHED");
    console.timeEnd("Process time");
    process.exit(0);
  })
  .catch((err) => {
    console.error(`ERROR | Session Expire queue insert | ${err.message}`);
    process.exit(1);
  });
