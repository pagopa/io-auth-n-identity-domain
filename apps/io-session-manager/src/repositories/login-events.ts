import * as RTE from "fp-ts/ReaderTaskEither";
import {
  AuthSessionsTopicRepository,
  AuthSessionsTopicRepositoryDeps,
} from "@pagopa/io-auth-n-identity-commons/repositories/auth-sessions-topic-repository";
import { LoginEvent } from "@pagopa/io-auth-n-identity-commons/types/auth-session-event";

export type LoginEventsDeps = {
  AuthSessionsTopicRepository: AuthSessionsTopicRepository;
} & AuthSessionsTopicRepositoryDeps;

export const emitLoginEvent: (
  loginEvent: LoginEvent,
) => RTE.ReaderTaskEither<LoginEventsDeps, Error, void> =
  (loginEvent) => (deps) =>
    deps.AuthSessionsTopicRepository.emitSessionEvent(loginEvent)(deps);
