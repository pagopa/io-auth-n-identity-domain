import { ServiceBusSender } from "@azure/service-bus";
import * as E from "fp-ts/Either";
import * as RTE from "fp-ts/ReaderTaskEither";
import * as TE from "fp-ts/TaskEither";
import { AuthSessionEvent } from "../types/auth-session-event";

export type AuthSessionsServiceBusTopicRepositoryDeps = {
  authSessionsServiceBusTopicSender: ServiceBusSender;
};

const emitSessionEvent: (
  eventData: AuthSessionEvent,
) => RTE.ReaderTaskEither<
  AuthSessionsServiceBusTopicRepositoryDeps,
  Error,
  void
> = (eventData) => (deps) =>
  TE.tryCatch(
    () =>
      deps.authSessionsServiceBusTopicSender.sendMessages({
        body: eventData,
        contentType: "application/json",
        applicationProperties: {
          evetType: eventData.eventType,
        },
        sessionId: eventData.fiscalCode,
      }),
    E.toError,
  );

export type AuthSessionsServiceBusTopicRepository =
  typeof AuthSessionsServiceBusTopicRepository;
export const AuthSessionsServiceBusTopicRepository = {
  emitSessionEvent,
};
