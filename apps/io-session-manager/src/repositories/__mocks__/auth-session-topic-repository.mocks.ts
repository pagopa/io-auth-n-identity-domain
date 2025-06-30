import { AuthSessionsTopicRepository } from "@pagopa/io-auth-n-identity-commons/repositories/auth-sessions-topic-repository";
import * as TE from "fp-ts/lib/TaskEither";
import { vi } from "vitest";

export const mockEmitSessionEvent = vi
  .fn()
  .mockImplementation(
    () => () => TE.right(void 0) as TE.TaskEither<Error, void>,
  );

export const mockAuthSessionsTopicRepository = {
  emitSessionEvent: mockEmitSessionEvent,
} as AuthSessionsTopicRepository;
