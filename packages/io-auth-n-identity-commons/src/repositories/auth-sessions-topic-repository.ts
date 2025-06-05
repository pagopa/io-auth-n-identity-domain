import { ServiceBusSender } from "@azure/service-bus";
import * as E from "fp-ts/Either";
import * as RTE from "fp-ts/ReaderTaskEither";
import * as TE from "fp-ts/TaskEither";
import { AuthSessionEvent } from "../types/auth-session-event";

export type AuthSessionsTopicRepositoryDeps = {
  authSessionsTopicSender: ServiceBusSender;
};
const emitSessionEvent: (
  eventData: AuthSessionEvent,
) => RTE.ReaderTaskEither<AuthSessionsTopicRepositoryDeps, Error, void> =
  (eventData) => (deps) =>
    TE.tryCatch(
      () =>
        deps.authSessionsTopicSender.sendMessages({
          body: AuthSessionEvent.encode(eventData),
          contentType: "application/json",
          applicationProperties: {
            evetType: eventData.eventType, // subscriptions filters apply to applicationProperties
          },
          sessionId: eventData.fiscalCode, // fiscalCode as ServiceBus session identifier
        }),
      E.toError,
    );

export type AuthSessionsTopicRepository = typeof AuthSessionsTopicRepository;
export const AuthSessionsTopicRepository = {
  emitSessionEvent,
};
