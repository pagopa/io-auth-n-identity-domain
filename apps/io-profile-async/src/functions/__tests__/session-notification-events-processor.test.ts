/* eslint-disable max-lines-per-function */
import { Context } from "@azure/functions";
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
import { afterEach, describe, expect, it, vi } from "vitest";
import { SessionNotificationEventsProcessorConfig } from "../../config";
import { SessionNotificationsModel } from "../../models/session-notifications";
import { SessionNotificationsRepository } from "../../repositories/session-notifications";
import { RetrievedSessionNotificationsStrict } from "../../types/session-notification-strict";
import * as appinsights from "../../utils/appinsights";
import { PermanentError } from "../../utils/errors";
import { contextMock } from "../__mocks__/azurefunctions.mock";
import {
  SessionNotificationEventsProcessorFunction,
  TriggerDependencies
} from "../session-notification-events-processor";

const aFiscalCode = "AAAAAA89S20I111X" as FiscalCode;
const anExpiredAt = new Date("2026-06-11T12:00:00Z");

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
  SESSION_NOTIFICATION_EVENTS_PROCESSOR_CHUNK_SIZE: 100,
  SERVICEBUS_NOTIFICATION_EVENT_SUBSCRIPTION_MAX_DELIVERY_COUNT: 10
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
      PermanentError | CosmosErrors,
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

const serviceBusTriggerContextMock = ({
  ...contextMock,
  bindingData: {
    messageId: "aServiceBusMessageId",
    deliveryCount: 1
  }
} as unknown) as Context;

describe("Expired Sessions Discoverer ServiceBusTrigger Tests", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });
  describe("Log-In Event Processing", () => {
    it("should process the event succesfully removing previous cosmosDB records when present", async () => {
      await expect(
        SessionNotificationEventsProcessorFunction(deps)(
          serviceBusTriggerContextMock,
          aValidServiceBusLoginEventMessage
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
      expect(createRecordMock).toHaveBeenCalledOnce();
      expect(createRecordMock).toHaveBeenCalledWith(
        aValidServiceBusLoginEventMessage.fiscalCode,
        aValidServiceBusLoginEventMessage.expiredAt,
        sessionNotificationEventsProcessorConfigMock.SESSION_NOTIFICATION_EVENTS_PROCESSOR_TTL_OFFSET
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
          serviceBusTriggerContextMock,
          aValidServiceBusLoginEventMessage
        )
      ).resolves.not.toThrow();

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
        sessionNotificationEventsProcessorConfigMock.SESSION_NOTIFICATION_EVENTS_PROCESSOR_TTL_OFFSET
      );
    });
  });
  describe("Log-Out Event Processing", () => {
    it("should process the event succesfully removing previous cosmosDB records when present", async () => {
      await expect(
        SessionNotificationEventsProcessorFunction(deps)(
          serviceBusTriggerContextMock,
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
          serviceBusTriggerContextMock,
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

  describe("Transient and Permanent Errors Handling", () => {
    it("should throw on TransientError when an error occurred while finding previousEvents", async () => {
      findByFiscalCodeAsyncIterableMock.mockReturnValueOnce((_deps: unknown) =>
        (async function*() {
          yield await Promise.reject(anError);
        })()
      );

      await expect(
        SessionNotificationEventsProcessorFunction(deps)(
          serviceBusTriggerContextMock,
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
          serviceBusTriggerContextMock,
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
          serviceBusTriggerContextMock,
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
          serviceBusTriggerContextMock,
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
          serviceBusTriggerContextMock,
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
        sessionNotificationEventsProcessorConfigMock.SESSION_NOTIFICATION_EVENTS_PROCESSOR_TTL_OFFSET
      );
    });

    it("should fail silently on PermanentError while creating new record(Bad TTL)", async () => {
      const permanentError = new PermanentError(
        "Unable to calculate New Record TTL, the reason was => value -1000 at root is not a valid [integer >= 0]"
      );

      createRecordMock.mockReturnValueOnce(
        RTE.fromEither(E.left(permanentError))
      );

      await expect(
        SessionNotificationEventsProcessorFunction(deps)(
          serviceBusTriggerContextMock,
          aValidServiceBusLoginEventMessage
        )
      ).resolves.not.toThrow();

      expect(trackEventMock).toHaveBeenCalledOnce();
      expect(trackEventMock).toHaveBeenCalledWith({
        name:
          "io.citizen-auth.prof-async.session-notification-events-processor.permanent.unable-to-build-new-record",
        properties: {
          expiredAt: anExpiredAt,
          reason: permanentError,
          message: "Unable to build new session-notifications record"
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
        sessionNotificationEventsProcessorConfigMock.SESSION_NOTIFICATION_EVENTS_PROCESSOR_TTL_OFFSET
      );
    });

    it("should emit a customEvent on TransientError and last retry", async () => {
      const error = ({
        kind: "COSMOS_ERROR",
        error: anError
      } as unknown) as CosmosErrors;
      createRecordMock.mockReturnValueOnce(RTE.fromEither(E.left(error)));

      const aLastRetryContextMock = ({
        ...serviceBusTriggerContextMock,
        bindingData: {
          ...serviceBusTriggerContextMock.bindingData,
          deliveryCount:
            sessionNotificationEventsProcessorConfigMock.SERVICEBUS_NOTIFICATION_EVENT_SUBSCRIPTION_MAX_DELIVERY_COUNT
        }
      } as unknown) as Context;

      const expectedErrorMessage =
        "An Error occurred while creating a new session record";

      await expect(
        SessionNotificationEventsProcessorFunction(deps)(
          aLastRetryContextMock,
          aValidServiceBusLoginEventMessage
        )
      ).rejects.toThrow(expectedErrorMessage);

      expect(trackEventMock).toHaveBeenCalledWith({
        name:
          "io.citizen-auth.session-notification-events-processor.max-retry-reached",
        properties: {
          errorMessage: expectedErrorMessage,
          message: "Reached max retry for event processing",
          messageId: aLastRetryContextMock.bindingData.messageId
        },
        tagOverrides: {
          samplingEnabled: "false"
        }
      });
    });
  });

  describe("Invalid Event Event Message Processing", () => {
    it("should throw in case of a bad message having an known eventType", async () => {
      await expect(
        SessionNotificationEventsProcessorFunction(deps)(
          serviceBusTriggerContextMock,
          {
            eventType: EventTypeEnum.LOGOUT,
            aBadProp: aFiscalCode
          }
        )
      ).rejects.toThrow("Bad Message Received having a known eventType");

      expect(trackEventMock).not.toHaveBeenCalled();

      expect(findByFiscalCodeAsyncIterableMock).not.toHaveBeenCalled();
      expect(deleteRecordMock).not.toHaveBeenCalled();
      expect(createRecordMock).not.toHaveBeenCalled();
    });

    it("should fail silently in case of a bad message having an unknown eventType", async () => {
      await expect(
        SessionNotificationEventsProcessorFunction(deps)(
          serviceBusTriggerContextMock,
          {
            eventType: "anUnknownEventType",
            fiscalCode: aFiscalCode
          }
        )
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
