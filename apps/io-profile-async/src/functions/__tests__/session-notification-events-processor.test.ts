/* eslint-disable functional/no-let */
/* eslint-disable functional/immutable-data */
import {
  EventTypeEnum,
  LoginEvent,
  LogoutEvent
} from "@pagopa/io-auth-n-identity-commons/types/auth-session-event";
import { CosmosErrors } from "@pagopa/io-functions-commons/dist/src/utils/cosmosdb_model";
import { FiscalCode } from "@pagopa/ts-commons/lib/strings";
import * as E from "fp-ts/Either";
import * as RTE from "fp-ts/ReaderTaskEither";
import { Validation } from "io-ts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SessionNotificationEventsProcessorConfig } from "../../config";
import { SessionNotificationsModel } from "../../models/session-notifications";
import { SessionNotificationsRepository } from "../../repositories/session-notifications";
import { RetrievedSessionNotificationsStrict } from "../../types/session-notification-strict";
import * as appinsights from "../../utils/appinsights";
import { contextMock } from "../__mocks__/azurefunctions.mock";
import {
  SessionNotificationEventsProcessorFunction,
  TriggerDependencies
} from "../session-notification-events-processor";

const aFiscalCode = "AAAAAA89S20I111X" as FiscalCode;
const anExpiredAt = new Date("2026-06-11T12:00:00Z");
const aYearInSeconds = 31536000; // 1 year in seconds

const validSessionNotifications: RetrievedSessionNotificationsStrict = {
  id: aFiscalCode,
  expiredAt: anExpiredAt.getTime(),
  notificationEvents: {},
  _etag: "etag",
  _rid: "rid",
  _self: "self",
  _ts: 123
};

const aValidServiceBusLoginEventMessage: LoginEvent = ({
  eventType: EventTypeEnum.LOGIN,
  fiscalCode: aFiscalCode,
  expiredAt: anExpiredAt.getTime()
} as unknown) as LoginEvent;

const aValidServiceBusLogoutEventMessage: LogoutEvent = {
  eventType: EventTypeEnum.LOGOUT,
  fiscalCode: aFiscalCode
};

const sessionNotificationEventsProcessorConfigMock = {
  SESSION_NOTIFICATION_EVENTS_PROCESSOR_TTL_OFFSET: 432000, // 5 days in seconds
  SESSION_NOTIFICATION_EVENTS_PROCESSOR_CHUNK_SIZE: 100
} as SessionNotificationEventsProcessorConfig;

const deleteRecordMock = vi.fn(
  () =>
    RTE.of(void 0) as RTE.ReaderTaskEither<
      TriggerDependencies,
      CosmosErrors,
      void
    >
);

const createRecordMock = vi.fn(
  () =>
    RTE.of(void 0) as RTE.ReaderTaskEither<
      TriggerDependencies,
      CosmosErrors,
      void
    >
);

const findByFiscalCodeAsyncIterableMock = vi.fn(() => (_deps: unknown) =>
  (async function*() {
    yield [
      E.right(validSessionNotifications) as Validation<
        RetrievedSessionNotificationsStrict
      >
    ];
  })()
);

const mockSessionNotificationsRepository = ({
  findByFiscalCodeAsyncIterable: findByFiscalCodeAsyncIterableMock,
  deleteRecord: deleteRecordMock,
  createRecord: createRecordMock
} as unknown) as SessionNotificationsRepository;

const mockSessionsNotificationModel = ({
  buildAsyncIterable: vi.fn(),
  patch: vi.fn(),
  create: vi.fn(),
  delete: vi.fn()
} as unknown) as SessionNotificationsModel;

const deps = {
  sessionNotificationEventsProcessorConfig: sessionNotificationEventsProcessorConfigMock,
  SessionNotificationsRepo: mockSessionNotificationsRepository,
  sessionNotificationsModel: mockSessionsNotificationModel
};

const trackEventMock = vi.spyOn(appinsights, "trackEvent");

describe("Expired Sessions Discoverer TimerTrigger Tests", () => {
  const baseDate = new Date("2025-06-11T12:00:00Z");

  beforeEach(() => {
    vi.setSystemTime(baseDate);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should process a valid Login event successfully", async () => {
    await expect(
      SessionNotificationEventsProcessorFunction(deps)(
        contextMock,
        aValidServiceBusLoginEventMessage
      )
    ).resolves.not.toThrow();

    const expectedTtl =
      aYearInSeconds +
      sessionNotificationEventsProcessorConfigMock.SESSION_NOTIFICATION_EVENTS_PROCESSOR_TTL_OFFSET;

    expect(trackEventMock).not.toHaveBeenCalled();
    expect(findByFiscalCodeAsyncIterableMock).toHaveBeenCalledWith(
      aValidServiceBusLoginEventMessage.fiscalCode,
      sessionNotificationEventsProcessorConfigMock.SESSION_NOTIFICATION_EVENTS_PROCESSOR_CHUNK_SIZE
    );
    expect(deleteRecordMock).toHaveBeenCalledTimes(1);
    expect(deleteRecordMock).toHaveBeenCalledWith(
      aValidServiceBusLoginEventMessage.fiscalCode,
      aValidServiceBusLoginEventMessage.expiredAt
    );
    expect(createRecordMock).toHaveBeenCalledTimes(1);
    expect(createRecordMock).toHaveBeenCalledWith(
      aValidServiceBusLoginEventMessage.fiscalCode,
      aValidServiceBusLoginEventMessage.expiredAt,
      expectedTtl
    );
  });

  it("should process a valid Logout event successfully", async () => {
    await expect(
      SessionNotificationEventsProcessorFunction(deps)(
        contextMock,
        aValidServiceBusLogoutEventMessage
      )
    ).resolves.not.toThrow();

    expect(trackEventMock).not.toHaveBeenCalled();
    expect(findByFiscalCodeAsyncIterableMock).toHaveBeenCalledWith(
      aValidServiceBusLoginEventMessage.fiscalCode,
      sessionNotificationEventsProcessorConfigMock.SESSION_NOTIFICATION_EVENTS_PROCESSOR_CHUNK_SIZE
    );
    expect(deleteRecordMock).toHaveBeenCalledTimes(1);
    expect(deleteRecordMock).toHaveBeenCalledWith(
      aValidServiceBusLoginEventMessage.fiscalCode,
      aValidServiceBusLoginEventMessage.expiredAt
    );
    expect(createRecordMock).not.toHaveBeenCalled();
  });

  it("should throw in case of a bad message having an known eventType", async () => {
    await expect(
      SessionNotificationEventsProcessorFunction(deps)(contextMock, {
        eventType: EventTypeEnum.LOGOUT,
        aBadProp: aFiscalCode
      })
    ).rejects.toThrow("Bad Message Received having a known eventType");

    expect(trackEventMock).not.toHaveBeenCalled();

    expect(findByFiscalCodeAsyncIterableMock).not.toHaveBeenCalled();
    expect(deleteRecordMock).not.toHaveBeenCalled();
    expect(createRecordMock).not.toHaveBeenCalled();
  });

  it("should fail silently in case of a bad message having an unknown eventType", async () => {
    await expect(
      SessionNotificationEventsProcessorFunction(deps)(contextMock, {
        eventType: "anUnknownEventType",
        fiscalCode: aFiscalCode
      })
    ).resolves.not.toThrow();

    expect(trackEventMock).toHaveBeenCalledWith({
      name:
        "io.citizen-auth.prof-async.session-notification-events-processor.permanent.bad-message",
      properties: expect.objectContaining({
        message: "Received A Bad Message"
      }),
      tagOverrides: {
        samplingEnabled: "false"
      }
    });

    expect(findByFiscalCodeAsyncIterableMock).not.toHaveBeenCalled();
    expect(deleteRecordMock).not.toHaveBeenCalled();
    expect(createRecordMock).not.toHaveBeenCalled();
  });
});
