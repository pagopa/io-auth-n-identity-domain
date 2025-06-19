import { ServiceBusSender } from "@azure/service-bus";
import { FiscalCode } from "@pagopa/ts-commons/lib/strings";
import * as E from "fp-ts/Either";
import { describe, expect, it, vi } from "vitest";
import {
  EventTypeEnum,
  LoginEvent,
  LogoutEvent,
} from "../../types/auth-session-event";
import { AuthSessionsTopicRepository } from "../auth-sessions-topic-repository";

const contentType = "application/json";

const aLoginEvent: LoginEvent = {
  eventType: EventTypeEnum.LOGIN,
  fiscalCode: "AAAAAA89S20I111X" as FiscalCode,
  expiredAt: new Date("2025-01-01T00:00:00Z"),
  loginType: "lv",
  scenario: "standard",
  idp: "idp.example.com",
  ts: new Date("2025-01-01T00:00:00Z"),
};

const aLogoutEvent: LogoutEvent = {
  eventType: EventTypeEnum.LOGOUT,
  fiscalCode: "BBBAAA89S20I111X" as FiscalCode,
  scenario: "app",
  ts: new Date("2025-01-01T10:00:00Z"),
};

const sendMessagesMock = vi.fn();

const serviceBusSenderMock = {
  sendMessages: sendMessagesMock,
} as unknown as ServiceBusSender;

const deps = { authSessionsTopicSender: serviceBusSenderMock };

describe("AuthSessionsTopicRepository", () => {
  it("should successfully emit a Log-Out event", async () => {
    sendMessagesMock.mockResolvedValueOnce(void 0);

    const result =
      await AuthSessionsTopicRepository.emitSessionEvent(aLogoutEvent)(deps)();

    expect(sendMessagesMock).toHaveBeenCalledWith({
      body: { ...aLogoutEvent, ts: aLogoutEvent.ts.getTime() },
      contentType,
      applicationProperties: {
        eventType: aLogoutEvent.eventType,
      },
      sessionId: aLogoutEvent.fiscalCode,
    });
    expect(E.isRight(result)).toBe(true);
  });

  it("should successfully emit a Log-In event", async () => {
    sendMessagesMock.mockResolvedValueOnce(void 0);

    const result =
      await AuthSessionsTopicRepository.emitSessionEvent(aLoginEvent)(deps)();

    expect(sendMessagesMock).toHaveBeenCalledWith({
      body: {
        ...aLoginEvent,
        expiredAt: aLoginEvent.expiredAt.getTime(),
        ts: aLoginEvent.ts.getTime(),
      },
      contentType,
      applicationProperties: {
        eventType: aLoginEvent.eventType,
      },
      sessionId: aLoginEvent.fiscalCode,
    });
    expect(E.isRight(result)).toBe(true);
  });

  it("should fail on sender failure emitting an event", async () => {
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
        ts: aLoginEvent.ts.getTime(),
      },
      contentType,
      applicationProperties: {
        eventType: aLoginEvent.eventType,
      },
      sessionId: aLoginEvent.fiscalCode,
    });
    expect(result).toStrictEqual(E.left(aServiceBusSenderError));
  });
});
