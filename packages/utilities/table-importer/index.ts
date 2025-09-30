/* eslint-disable no-console */
import * as E from "fp-ts/Either";
import * as ROA from "fp-ts/ReadonlyArray";
import * as TE from "fp-ts/TaskEither";
import yargs from "yargs";
import { pipe } from "fp-ts/lib/function";
import { hideBin } from "yargs/helpers";
import { readableReportSimplified } from "@pagopa/ts-commons/lib/reporters";
import { TableClient } from "@azure/data-tables";
import { Config } from "./types";
import { copyTableData } from "./table";

console.time("Process time");
const run = async () => {
  const args = await yargs(hideBin(process.argv))
    .command(
      "originStorageConnectionString",
      "Connection string to the origin storage account",
    )
    .command("originTableName", "Origin table name")
    .command(
      "destinationStorageConnectionString",
      "Connection string to the destination storage account",
    )
    .command("destinationTableName", "Destination table name")
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

  const originClient = TableClient.fromConnectionString(
    config.originStorageConnectionString,
    config.originTableName,
  );
  const destinationClient = TableClient.fromConnectionString(
    config.destinationStorageConnectionString,
    config.destinationTableName,
  );

  return await pipe(
    copyTableData(originClient, destinationClient),
    TE.mapLeft((errors) => {
      console.error(
        `ERROR | Table importer | Failed to copy data: ${ROA.map(
          (e: Error) => e.message,
        )(errors).join(", ")}`,
      );
      return errors;
    }),
    TE.map(() => {
      console.info("SUCCESS | Table importer | Data copied successfully");
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
    console.error(`ERROR | Table importer | ${err.message}`);
    process.exit(1);
  });
