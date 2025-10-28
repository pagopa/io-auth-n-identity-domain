import { EventTypeEnum } from "@pagopa/io-auth-n-identity-commons/types/session-event/event-type";
import * as E from "fp-ts/lib/Either";
import * as TE from "fp-ts/lib/TaskEither";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  LoginEvent,
  LoginScenarioEnum,
  LoginTypeEnum,
} from "@pagopa/io-auth-n-identity-commons/types/session-event/login-event";
import { AuthSessionEventsRepo } from "..";
import { mockServiceBusSender } from "../../__mocks__/service-bus-sender.mocks";
import { mockedUser } from "../../__mocks__/user.mocks";
import {
  mockAuthSessionsTopicRepository,
  mockEmitSessionEvent,
} from "../__mocks__/auth-session-topic-repository.mocks";

const deps = {
  AuthSessionsTopicRepository: mockAuthSessionsTopicRepository,
  authSessionsTopicSender: mockServiceBusSender,
} as AuthSessionEventsRepo.AuthSessionEventsDeps;

describe("emitLoginEvent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockLoginEvent: LoginEvent = {
    eventType: EventTypeEnum.LOGIN,
    fiscalCode: mockedUser.fiscal_code,
    loginType: LoginTypeEnum.LV,
    scenario: LoginScenarioEnum.STANDARD,
    idp: "test-idp",
    ts: new Date(2025, 0, 10),
    expiredAt: new Date(2026, 0, 10),
  };

  it("should call emitSessionEvent with the correct arguments and resolve on success", async () => {
    const result =
      await AuthSessionEventsRepo.emitAuthSessionEvent(mockLoginEvent)(deps)();

    expect(mockEmitSessionEvent).toHaveBeenCalledWith(mockLoginEvent);
    expect(E.isRight(result)).toBe(true);
  });

  it("should return a Left if emitSessionEvent rejects", async () => {
    const error = new Error("emit failed");
    mockEmitSessionEvent.mockImplementationOnce(() => () => TE.left(error));

    const result =
      await AuthSessionEventsRepo.emitAuthSessionEvent(mockLoginEvent)(deps)();

    expect(mockEmitSessionEvent).toHaveBeenCalledWith(mockLoginEvent);
    expect(E.isLeft(result)).toBe(true);
    if (E.isLeft(result)) {
      expect(result.left).toBe(error);
    }
  });
});
