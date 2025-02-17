/* eslint-disable no-console */
import { QueueClient } from "@azure/storage-queue";
import { pipe } from "fp-ts/function";
import * as TE from "fp-ts/TaskEither";
import * as T from "fp-ts/Task";
import * as E from "fp-ts/Either";
import * as ROA from "fp-ts/ReadonlyArray";
import NodeClient from "applicationinsights/out/Library/NodeClient";

export type Item<T> = {
  payload: T;
  itemTimeoutInSeconds?: number;
};

export type CommonDependencies = {
  client: QueueClient;
  appInsightsTelemetryClient?: NodeClient;
};

type Dependencies<T> = CommonDependencies & {
  item: Item<T>;
};

type BatchDependencies<T> = CommonDependencies & {
  batch: ReadonlyArray<Item<T>>;
};

const base64EncodeObject = <T>(item: T): string =>
  Buffer.from(JSON.stringify(item)).toString("base64");

const sendMessage: <T>(deps: {
  client: QueueClient;
  item: Item<T>;
}) => TE.TaskEither<Error, true> = ({ client, item }) =>
  pipe(
    E.tryCatch(() => base64EncodeObject(item.payload), E.toError),
    TE.fromEither,
    TE.chain((toEnqueue) =>
      TE.tryCatch(
        () =>
          client.sendMessage(toEnqueue, {
            visibilityTimeout: item.itemTimeoutInSeconds,
          }),
        (error) => {
          console.error(
            `ERROR | Couldn't send item with payload ${JSON.stringify(item.payload)} | [${error}]`,
          );
          // return item for further processing
          return Error(JSON.stringify(item.payload));
        },
      ),
    ),
    TE.map(() => true),
  );

const onError = (appInsightsTelemetryClient?: NodeClient) => (error: Error) => {
  console.error(`ERROR | insertItemIntoQueue: ${error.message}`);
  appInsightsTelemetryClient?.trackEvent({
    name: "queue.insert.failure",
    tagOverrides: { samplingEnabled: "false" },
  });
  return error;
};

export const insertItemIntoQueue: <T>(
  deps: Dependencies<T>,
) => TE.TaskEither<Error, true> = (deps) =>
  pipe(sendMessage(deps), TE.mapLeft(onError(deps.appInsightsTelemetryClient)));

export const insertBatchIntoQueue: <T>(
  deps: BatchDependencies<T>,
) => TE.TaskEither<ReadonlyArray<Error>, true> = (deps) =>
  pipe(
    deps.batch,
    ROA.map((item) =>
      pipe(
        sendMessage({
          client: deps.client,
          item,
        }),
        TE.mapLeft((error) => [error]),
      ),
    ),
    // NOTE: T.ApplicativeSeq to continue regardless of the result of the
    // processed item
    ROA.sequence(
      TE.getApplicativeTaskValidation(
        T.ApplicativePar,
        ROA.getSemigroup<Error>(),
      ),
    ),
    TE.map(() => true as const),
    TE.mapLeft(ROA.map(onError(deps.appInsightsTelemetryClient))),
  );
