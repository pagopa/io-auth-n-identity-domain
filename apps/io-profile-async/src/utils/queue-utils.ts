/* eslint-disable no-console */

import { QueueClient } from "@azure/storage-queue";
import { pipe } from "fp-ts/function";
import * as TE from "fp-ts/TaskEither";
import * as E from "fp-ts/Either";
import NodeClient from "applicationinsights/out/Library/NodeClient";

export class QueueTransientError extends Error {
  constructor(message?: string, error?: Error) {
    super(message, error);
    this.name = "QueueTransientError";
  }
}

// Custom Error to avoid queueTrigger retry
export class QueuePermanentError extends Error {
  constructor(message?: string, error?: Error) {
    super(message, error);
    this.name = "QueuePermanentError";
  }
}

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

const base64EncodeObject = <T>(item: T): string =>
  Buffer.from(JSON.stringify(item)).toString("base64");

const sendMessage: <T>(deps: {
  client: QueueClient;
  item: Item<T>;
}) => TE.TaskEither<Error, true> = ({ client, item }) =>
  pipe(
    TE.tryCatch(async () => base64EncodeObject(item.payload), E.toError),
    TE.chain(toEnqueue =>
      TE.tryCatch(
        () =>
          client.sendMessage(toEnqueue, {
            visibilityTimeout: item.itemTimeoutInSeconds
          }),
        error => {
          console.error(
            `ERROR | Couldn't send item with payload ${JSON.stringify(
              item.payload
            )} | [${error}]`
          );
          // return item for further processing
          return Error(JSON.stringify(item.payload));
        }
      )
    ),
    TE.map(() => true)
  );

const onError = (appInsightsTelemetryClient?: NodeClient) => (error: Error) => {
  console.error(`ERROR | insertItemIntoQueue: ${error.message}`);
  appInsightsTelemetryClient?.trackEvent({
    name: "queue.insert.failure",
    tagOverrides: { samplingEnabled: "false" }
  });
  return error;
};

export const insertItemIntoQueue: <T>(
  deps: Dependencies<T>
) => TE.TaskEither<Error, true> = deps =>
  pipe(sendMessage(deps), TE.mapLeft(onError(deps.appInsightsTelemetryClient)));
