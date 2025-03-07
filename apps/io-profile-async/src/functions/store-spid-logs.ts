import * as TE from "fp-ts/lib/TaskEither";
import * as RTE from "fp-ts/lib/ReaderTaskEither";

import * as H from "@pagopa/handler-kit";
import { azureFunction } from "@pagopa/handler-kit-azure-func";

import {
  EncryptedPayload,
  toEncryptedPayload
} from "@pagopa/ts-commons/lib/encrypt";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";

import { pipe } from "fp-ts/lib/function";

import * as t from "io-ts";

import { readableReport } from "@pagopa/ts-commons/lib/reporters";
import { sequenceS } from "fp-ts/lib/Apply";
import {
  SpidBlobItem,
  StoreSpidLogsQueueMessage
} from "../types/store-spid-logs-queue-message";
import { QueuePermanentError } from "../utils/queue-utils";
import { Tracker, TrackerRepositoryDependency } from "../repositories";

export type HandlerDependencies = {
  tracker: Tracker;
  spidLogsPublicKey: NonEmptyString;
} & TrackerRepositoryDependency;

export type HandlerOutput = void | {
  spidRequestResponse: SpidBlobItem;
};

const encrypt: (
  plainText: string
) => RTE.ReaderTaskEither<
  HandlerDependencies,
  QueuePermanentError,
  EncryptedPayload
> = plainText => ({ spidLogsPublicKey }) =>
  pipe(
    toEncryptedPayload(spidLogsPublicKey, plainText),
    TE.fromEither,
    TE.mapLeft(e => new QueuePermanentError(`Cannot encrypt payload ${e}`))
  );

export const makeHandler: H.Handler<
  StoreSpidLogsQueueMessage,
  HandlerOutput,
  HandlerDependencies
> = H.of(queueInput => deps =>
  pipe(
    sequenceS(TE.ApplicativePar)({
      encryptedRequestPayload: encrypt(queueInput.requestPayload)(deps),
      encryptedResponsePayload: encrypt(queueInput.responsePayload)(deps),
      createdAt: TE.of(queueInput.createdAt),
      ip: TE.of(queueInput.ip),
      spidRequestId: TE.of(queueInput.spidRequestId)
    }),
    TE.chain((encryptedBlobItem: SpidBlobItem) =>
      pipe(
        t.exact(SpidBlobItem).decode(encryptedBlobItem),
        TE.fromEither,
        TE.map(spidBlobItem => ({
          spidRequestResponse: spidBlobItem
        })),
        TE.mapLeft(
          errs =>
            new QueuePermanentError(
              `Cannot decode payload${readableReportSimplified(errs)}`
            )
        )
      )
    ),
    TE.orElseW(error => {
      if (error instanceof QueuePermanentError) {
        return TE.fromIO(() =>
          deps.tracker.trackEvent(
            "io.citizen-auth.prof-async.store-spid-logs.error.permanent" as NonEmptyString,
            error.message as NonEmptyString
          )(deps)
        );
      } else {
        return TE.left(error);
      }
    })
  )
);

export const StoreSpidLogsFunction = azureFunction(makeHandler);
