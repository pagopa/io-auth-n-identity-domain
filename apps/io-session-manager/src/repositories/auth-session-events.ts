import * as RTE from "fp-ts/ReaderTaskEither";
import {
  AuthSessionsTopicRepository,
  AuthSessionsTopicRepositoryDeps,
} from "@pagopa/io-auth-n-identity-commons/repositories/auth-sessions-topic-repository";
import { AuthSessionEvent } from "@pagopa/io-auth-n-identity-commons/types/auth-session-event";

export type AuthSessionEventsDeps = {
  AuthSessionsTopicRepository: AuthSessionsTopicRepository;
} & AuthSessionsTopicRepositoryDeps;

export const emitAuthSessionEvent: (
  event: AuthSessionEvent,
) => RTE.ReaderTaskEither<AuthSessionEventsDeps, Error, void> =
  (event) => (deps) =>
    deps.AuthSessionsTopicRepository.emitSessionEvent(event)(deps);
