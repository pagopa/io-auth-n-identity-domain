import { QueueClient, QueueSendMessageResponse } from "@azure/storage-queue";
import * as E from "fp-ts/Either";
import * as RTE from "fp-ts/ReaderTaskEither";
import * as TE from "fp-ts/TaskEither";
import { ExpiredSessionAdvisorQueueMessage } from "../types/expired-session-advisor-queue-message";
import { base64EncodeObject } from "../utils/encoding";

export type ExpiredUserSessionsQueueRepositoryDeps = {
  expiredUserSessionsQueueClient: QueueClient;
};

const sendExpiredUserSession: (
  message: ExpiredSessionAdvisorQueueMessage,
  visibilityTimeout: number
) => RTE.ReaderTaskEither<
  ExpiredUserSessionsQueueRepositoryDeps,
  Error,
  QueueSendMessageResponse
> = (message, visibilityTimeout) => deps =>
  TE.tryCatch(
    () =>
      deps.expiredUserSessionsQueueClient.sendMessage(
        base64EncodeObject(ExpiredSessionAdvisorQueueMessage.encode(message)),
        {
          visibilityTimeout
        }
      ),
    E.toError
  );

export type ExpiredUserSessionsQueueRepository = typeof ExpiredUserSessionsQueueRepository;
export const ExpiredUserSessionsQueueRepository = {
  sendExpiredUserSession
};
