import { ServiceBusSender } from "@azure/service-bus";
import { QueueSendMessageResponse } from "@azure/storage-queue";
import { FiscalCode } from "@pagopa/ts-commons/lib/strings";
import * as E from "fp-ts/Either";
import { describe, expect, it, vi } from "vitest";
import {
  AuthSessionEvent,
  EventTypeEunum,
} from "../../types/auth-session-event";
import { AuthSessionsTopicRepository } from "../auth-sessions-topic-repository";

const aLoginEvent: AuthSessionEvent = {
  eventType: EventTypeEunum.LOGIN,
  fiscalCode: "AAAAAA89S20I111X" as FiscalCode,
  expiredAt: new Date("2025-01-01T00:00:00Z"),
};

const aLogoutEvent: AuthSessionEvent = {
  eventType: EventTypeEunum.LOGOUT,
  fiscalCode: "BBBAAA89S20I111X" as FiscalCode,
};

const sendMessagesMock = vi.fn();

const serviceBusSenderMock = {
  sendMessages: sendMessagesMock,
} as unknown as ServiceBusSender;

const deps = { authSessionsTopicSender: serviceBusSenderMock };

describe("AuthSessionsTopicRepository", () => {
  it("should sucesfully emit a Logout Event", async () => {
    sendMessagesMock.mockResolvedValueOnce(void 0);

    const result =
      await AuthSessionsTopicRepository.emitSessionEvent(aLogoutEvent)(deps)();

    expect(sendMessagesMock).toHaveBeenCalledWith({
      body: aLogoutEvent,
      contentType: "application/json",
      applicationProperties: {
        evetType: aLogoutEvent.eventType,
      },
      sessionId: aLogoutEvent.fiscalCode,
    });
    expect(E.isRight(result)).toBe(true);
  });

  it("should sucesfully emit a Login Event", async () => {
    sendMessagesMock.mockResolvedValueOnce(void 0);

    const result =
      await AuthSessionsTopicRepository.emitSessionEvent(aLoginEvent)(deps)();

    expect(sendMessagesMock).toHaveBeenCalledWith({
      body: {
        ...aLoginEvent,
        expiredAt: aLoginEvent.expiredAt.getTime(),
      },
      contentType: "application/json",
      applicationProperties: {
        evetType: aLoginEvent.eventType,
      },
      sessionId: aLoginEvent.fiscalCode,
    });
    expect(E.isRight(result)).toBe(true);
  });

  it("should propagate the error on sender failure emitting an Event", async () => {
    const aServiceBusSenderError = new Error(
      "Failure sending message on ServiceBus",
    );

    sendMessagesMock.mockRejectedValueOnce(aServiceBusSenderError);

    const result =
      await AuthSessionsTopicRepository.emitSessionEvent(aLoginEvent)(deps)();

    expect(sendMessagesMock).toHaveBeenCalledWith({
      body: {
        ...aLoginEvent,
        expiredAt: aLoginEvent.expiredAt.getTime(),
      },
      contentType: "application/json",
      applicationProperties: {
        evetType: aLoginEvent.eventType,
      },
      sessionId: aLoginEvent.fiscalCode,
    });
    expect(result).toStrictEqual(E.left(aServiceBusSenderError));
  });
});
