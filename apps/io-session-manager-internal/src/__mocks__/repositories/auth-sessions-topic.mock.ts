import { vi } from "vitest";
import * as RTE from "fp-ts/lib/ReaderTaskEither";
import { AuthSessionsTopicRepository } from "@pagopa/io-auth-n-identity-commons/repositories/auth-sessions-topic-repository";
import { ServiceBusSender } from "@azure/service-bus";

const mockSendMessages = vi.fn();
export const ServiceBusSenderMock = {
  sendMessages: mockSendMessages,
} as unknown as ServiceBusSender;

export const mockEmitSessionEvent = vi
  .fn()
  .mockImplementation(() => RTE.right(void 0));
export const AuthSessionsTopicRepositoryMock: AuthSessionsTopicRepository = {
  emitSessionEvent: mockEmitSessionEvent,
};
