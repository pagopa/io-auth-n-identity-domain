/* eslint-disable no-console */
import fs from "fs";
import { pipe, flow } from "fp-ts/function";
import * as ROA from "fp-ts/ReadonlyArray";
import * as E from "fp-ts/Either";
import { FiscalCode } from "@pagopa/ts-commons/lib/strings";
import { readableReportSimplified } from "@pagopa/ts-commons/lib/reporters";
import { ItemPayload, ItemToEnqueue } from "./types";

const createItem = (
  fiscalCode: FiscalCode,
  itemTimeoutInSeconds: number,
): ItemToEnqueue => ({
  payload: { fiscalCode: fiscalCode as FiscalCode },
  itemTimeoutInSeconds,
});

export const createBatch =
  (batchCount: number, timeoutMultiplier: number) =>
  (list: ReadonlyArray<FiscalCode>) =>
    pipe(
      list,
      ROA.chunksOf(batchCount),
      ROA.mapWithIndex((chunkNumber, chunk) =>
        pipe(
          chunk,
          ROA.map((fiscalCode) =>
            // NOTE: first batch intentionally left with visibilityTimeout: 0
            createItem(fiscalCode, timeoutMultiplier * chunkNumber),
          ),
        ),
      ),
    );

export const importFileIntoBatches = (
  filename: string,
  batchCount: number,
  timeoutMultiplier: number,
): ReadonlyArray<ReadonlyArray<ItemToEnqueue>> =>
  pipe(
    fs.readFileSync(filename, { encoding: "utf-8" }),
    (content) => content.split("\n").filter((line) => line.length > 0),
    ROA.map(
      flow(
        FiscalCode.decode,
        E.getOrElseW((errors) => {
          throw Error(readableReportSimplified(errors));
        }),
      ),
    ),
    createBatch(batchCount, timeoutMultiplier),
    (batches) => {
      console.info(`SUCCESSFULLY CREATED ${batches.length} BATCH`);
      return batches;
    },
  );

export const exportErrorsIntoFile = (
  filename: string,
  errors: ReadonlyArray<Error>,
) =>
  pipe(
    errors,
    ROA.map((error) =>
      pipe(
        E.tryCatch(() => JSON.parse(error.message), E.toError),
        E.chainW(ItemPayload.decode),
        E.map((item) => fs.appendFileSync(filename, item.fiscalCode + "\n")),
        E.mapLeft(() => Error("Could not export errors to file")),
      ),
    ),
  );
