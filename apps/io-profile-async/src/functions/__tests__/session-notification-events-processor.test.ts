/* eslint-disable max-lines-per-function */
import {
  EventTypeEnum,
  LoginEvent,
  LogoutEvent
} from "@pagopa/io-auth-n-identity-commons/types/auth-session-event";
import { CosmosErrors } from "@pagopa/io-functions-commons/dist/src/utils/cosmosdb_model";
import { FiscalCode } from "@pagopa/ts-commons/lib/strings";
import * as E from "fp-ts/Either";
import * as RTE from "fp-ts/ReaderTaskEither";
import * as t from "io-ts";
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
const aPreviousExpiredAt = new Date("2025-05-11T12:00:00Z");
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

const afakeValidationError: t.ValidationError = {
  value: "some-invalid-value",
  context: [
    {
      key: "eventType",
      type: t.string,
      actual: validSessionNotifications
    }
  ],
  message: "Invalid eventType"
} as t.ValidationError;

const anError = new Error("Simulated failure");

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

const aVoidReaderTaskEither: RTE.ReaderTaskEither<
  TriggerDependencies,
  CosmosErrors,
  void
> = RTE.of(void 0) as RTE.ReaderTaskEither<
  TriggerDependencies,
  CosmosErrors,
  void
>;

const deleteRecordMock = vi.fn(() => aVoidReaderTaskEither);
const createRecordMock = vi.fn(() => aVoidReaderTaskEither);

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
  describe("Log-In Event Processing", () => {
    it("should process the event succesfully removing previous cosmosDB records when present", async () => {
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
      expect(deleteRecordMock).toHaveBeenCalledOnce();
      expect(deleteRecordMock).toHaveBeenCalledWith(
        aValidServiceBusLoginEventMessage.fiscalCode,
        aValidServiceBusLoginEventMessage.expiredAt
      );
      expect(createRecordMock).toHaveBeenCalledOnce();
      expect(createRecordMock).toHaveBeenCalledWith(
        aValidServiceBusLoginEventMessage.fiscalCode,
        aValidServiceBusLoginEventMessage.expiredAt,
        expectedTtl
      );
    });

    it("should process the event succesfully whitout removing previous cosmosDB records when not present", async () => {
      findByFiscalCodeAsyncIterableMock.mockReturnValueOnce(() =>
        (async function*() {
          yield [];
        })()
      );

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
      expect(deleteRecordMock).not.toHaveBeenCalled();
      expect(createRecordMock).toHaveBeenCalledOnce();
      expect(createRecordMock).toHaveBeenCalledWith(
        aValidServiceBusLoginEventMessage.fiscalCode,
        aValidServiceBusLoginEventMessage.expiredAt,
        expectedTtl
      );
    });
  });
  describe("Log-Out Event Processing", () => {
    it("should process the event succesfully removing previous cosmosDB records when present", async () => {
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
      expect(deleteRecordMock).toHaveBeenCalledOnce();
      expect(deleteRecordMock).toHaveBeenCalledWith(
        aValidServiceBusLoginEventMessage.fiscalCode,
        aValidServiceBusLoginEventMessage.expiredAt
      );
      expect(createRecordMock).not.toHaveBeenCalled();
    });

    it("should process the event succesfully whitout removing previous cosmosDB records when not present", async () => {
      // eslint-disable-next-line sonarjs/no-identical-functions
      findByFiscalCodeAsyncIterableMock.mockReturnValueOnce(() =>
        (async function*() {
          yield [];
        })()
      );

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
      expect(deleteRecordMock).not.toHaveBeenCalled();
      expect(createRecordMock).not.toHaveBeenCalled();
    });
  });

  describe("Errors attempting ComsosDB Operation", () => {
    it("should throw on TranisentError while finding previousEvents", async () => {
      findByFiscalCodeAsyncIterableMock.mockReturnValueOnce((_deps: unknown) =>
        (async function*() {
          yield await Promise.reject(anError);
        })()
      );

      await expect(
        SessionNotificationEventsProcessorFunction(deps)(
          contextMock,
          aValidServiceBusLoginEventMessage
        )
      ).rejects.toThrow(
        "Error retrieving session expirations, AsyncIterable fetch execution failure"
      );

      expect(trackEventMock).not.toHaveBeenCalled();
      expect(findByFiscalCodeAsyncIterableMock).toHaveBeenCalledWith(
        aValidServiceBusLoginEventMessage.fiscalCode,
        sessionNotificationEventsProcessorConfigMock.SESSION_NOTIFICATION_EVENTS_PROCESSOR_CHUNK_SIZE
      );
      expect(deleteRecordMock).not.toHaveBeenCalled();
      expect(createRecordMock).not.toHaveBeenCalled();
    });

    it("should throw on TransientError while deleting previousEvents", async () => {
      const error = ({
        kind: "COSMOS_ERROR",
        error: anError
      } as unknown) as CosmosErrors;

      deleteRecordMock.mockReturnValueOnce(RTE.fromEither(E.left(error)));

      await expect(
        SessionNotificationEventsProcessorFunction(deps)(
          contextMock,
          aValidServiceBusLoginEventMessage
        )
      ).rejects.toThrow(
        `An Error occurred while deleting previous records => ${error.kind}`
      );

      expect(trackEventMock).not.toHaveBeenCalled();
      expect(findByFiscalCodeAsyncIterableMock).toHaveBeenCalledWith(
        aValidServiceBusLoginEventMessage.fiscalCode,
        sessionNotificationEventsProcessorConfigMock.SESSION_NOTIFICATION_EVENTS_PROCESSOR_CHUNK_SIZE
      );
      expect(deleteRecordMock).toHaveBeenCalledOnce();
      expect(deleteRecordMock).toHaveBeenCalledWith(
        aValidServiceBusLoginEventMessage.fiscalCode,
        aValidServiceBusLoginEventMessage.expiredAt
      );
      expect(createRecordMock).not.toHaveBeenCalled();
    });

    it("should throw on TransientError while creating new record", async () => {
      const error = ({
        kind: "COSMOS_ERROR",
        error: anError
      } as unknown) as CosmosErrors;
      createRecordMock.mockReturnValueOnce(RTE.fromEither(E.left(error)));

      await expect(
        SessionNotificationEventsProcessorFunction(deps)(
          contextMock,
          aValidServiceBusLoginEventMessage
        )
      ).rejects.toThrow(
        "An Error occurred while creating a new session record"
      );

      expect(trackEventMock).not.toHaveBeenCalled();

      expect(findByFiscalCodeAsyncIterableMock).toHaveBeenCalledWith(
        aValidServiceBusLoginEventMessage.fiscalCode,
        sessionNotificationEventsProcessorConfigMock.SESSION_NOTIFICATION_EVENTS_PROCESSOR_CHUNK_SIZE
      );
      expect(deleteRecordMock).toHaveBeenCalledOnce();
      expect(deleteRecordMock).toHaveBeenCalledWith(
        aValidServiceBusLoginEventMessage.fiscalCode,
        aValidServiceBusLoginEventMessage.expiredAt
      );
      expect(createRecordMock).toHaveBeenCalledOnce();
      expect(createRecordMock).toHaveBeenCalledWith(
        aValidServiceBusLoginEventMessage.fiscalCode,
        aValidServiceBusLoginEventMessage.expiredAt,
        aYearInSeconds +
          sessionNotificationEventsProcessorConfigMock.SESSION_NOTIFICATION_EVENTS_PROCESSOR_TTL_OFFSET
      );
    });

    it("should not fail on Bad record received querying CosmosDB(only invalid item)", async () => {
      findByFiscalCodeAsyncIterableMock.mockReturnValueOnce(() =>
        (async function*() {
          yield [E.left([afakeValidationError])];
        })()
      );

      await expect(
        SessionNotificationEventsProcessorFunction(deps)(
          contextMock,
          aValidServiceBusLoginEventMessage
        )
      ).resolves.not.toThrow();

      expect(trackEventMock).toHaveBeenCalledOnce();
      expect(trackEventMock).toHaveBeenCalledWith({
        name:
          "io.citizen-auth.prof-async.session-notification-events-processor.permanent.bad-record",
        properties: {
          // eslint-disable-next-line no-underscore-dangle
          badRecordSelf: validSessionNotifications._self,
          message: "Found a non compliant db record"
        },
        tagOverrides: {
          samplingEnabled: "false"
        }
      });

      expect(findByFiscalCodeAsyncIterableMock).toHaveBeenCalledWith(
        aValidServiceBusLoginEventMessage.fiscalCode,
        sessionNotificationEventsProcessorConfigMock.SESSION_NOTIFICATION_EVENTS_PROCESSOR_CHUNK_SIZE
      );
      expect(deleteRecordMock).not.toHaveBeenCalled();

      expect(createRecordMock).toHaveBeenCalledOnce();
      expect(createRecordMock).toHaveBeenCalledWith(
        aValidServiceBusLoginEventMessage.fiscalCode,
        aValidServiceBusLoginEventMessage.expiredAt,
        aYearInSeconds +
          sessionNotificationEventsProcessorConfigMock.SESSION_NOTIFICATION_EVENTS_PROCESSOR_TTL_OFFSET
      );
    });

    it("should not fail on Bad record received querying CosmosDB (mixed query results, valid and invalid items)", async () => {
      findByFiscalCodeAsyncIterableMock.mockReturnValueOnce(() =>
        (async function*() {
          yield [
            E.left([afakeValidationError]),
            E.right(validSessionNotifications)
          ];
        })()
      );

      await expect(
        SessionNotificationEventsProcessorFunction(deps)(
          contextMock,
          aValidServiceBusLoginEventMessage
        )
      ).resolves.not.toThrow();

      expect(trackEventMock).toHaveBeenCalledOnce();
      expect(trackEventMock).toHaveBeenCalledWith({
        name:
          "io.citizen-auth.prof-async.session-notification-events-processor.permanent.bad-record",
        properties: {
          // eslint-disable-next-line no-underscore-dangle
          badRecordSelf: validSessionNotifications._self,
          message: "Found a non compliant db record"
        },
        tagOverrides: {
          samplingEnabled: "false"
        }
      });

      expect(findByFiscalCodeAsyncIterableMock).toHaveBeenCalledWith(
        aValidServiceBusLoginEventMessage.fiscalCode,
        sessionNotificationEventsProcessorConfigMock.SESSION_NOTIFICATION_EVENTS_PROCESSOR_CHUNK_SIZE
      );
      expect(deleteRecordMock).toHaveBeenCalledOnce();
      expect(deleteRecordMock).toHaveBeenCalledWith(
        aValidServiceBusLoginEventMessage.fiscalCode,
        aValidServiceBusLoginEventMessage.expiredAt
      );

      expect(createRecordMock).toHaveBeenCalledOnce();
      expect(createRecordMock).toHaveBeenCalledWith(
        aValidServiceBusLoginEventMessage.fiscalCode,
        aValidServiceBusLoginEventMessage.expiredAt,
        aYearInSeconds +
          sessionNotificationEventsProcessorConfigMock.SESSION_NOTIFICATION_EVENTS_PROCESSOR_TTL_OFFSET
      );
    });

    it("should fail silently on PermanentError while creating new record(Bad TTL)", async () => {
      await expect(
        SessionNotificationEventsProcessorFunction(deps)(contextMock, {
          ...aValidServiceBusLoginEventMessage,
          expiredAt: aPreviousExpiredAt.getTime()
        })
      ).resolves.not.toThrow();

      const expectedTtl =
        Math.floor((aPreviousExpiredAt.getTime() - baseDate.getTime()) / 1000) +
        sessionNotificationEventsProcessorConfigMock.SESSION_NOTIFICATION_EVENTS_PROCESSOR_TTL_OFFSET;

      expect(trackEventMock).toHaveBeenCalledOnce();
      expect(trackEventMock).toHaveBeenCalledWith({
        name:
          "io.citizen-auth.prof-async.session-notification-events-processor.permanent.unable-to-calculate-ttl",
        properties: {
          expiredAt: aPreviousExpiredAt,
          formattedError: `value ${expectedTtl} at root is not a valid [integer >= 0]`,
          message: "Unable to calculate TTL for new session record"
        },
        tagOverrides: {
          samplingEnabled: "false"
        }
      });

      expect(findByFiscalCodeAsyncIterableMock).toHaveBeenCalledWith(
        aValidServiceBusLoginEventMessage.fiscalCode,
        sessionNotificationEventsProcessorConfigMock.SESSION_NOTIFICATION_EVENTS_PROCESSOR_CHUNK_SIZE
      );
      expect(deleteRecordMock).toHaveBeenCalledOnce();
      expect(deleteRecordMock).toHaveBeenCalledWith(
        aValidServiceBusLoginEventMessage.fiscalCode,
        aValidServiceBusLoginEventMessage.expiredAt
      );
      expect(createRecordMock).not.toHaveBeenCalled();
    });
  });

  describe("Invalid Event Event Message Processing", () => {
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
});
