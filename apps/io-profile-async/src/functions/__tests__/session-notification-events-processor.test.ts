/* eslint-disable max-lines-per-function */
import { Context } from "@azure/functions";
import {
  EventTypeEnum,
  LoginEvent,
  LogoutEvent
} from "@pagopa/io-auth-n-identity-commons/types/auth-session-event";
import {
  LoginScenarioEnum,
  LoginTypeEnum
} from "@pagopa/io-auth-n-identity-commons/types/login-event";
import { LogoutScenarioEnum } from "@pagopa/io-auth-n-identity-commons/types/logout-event";
import { CosmosErrors } from "@pagopa/io-functions-commons/dist/src/utils/cosmosdb_model";
import * as E from "fp-ts/Either";
import * as RTE from "fp-ts/ReaderTaskEither";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  SessionNotificationEventsProcessorConfig,
  SessionNotificationsRepositoryConfig
} from "../../config";
import { SessionNotificationsModel } from "../../models/session-notifications";
import { SessionNotificationsRepository } from "../../repositories/session-notifications";
import * as appinsights from "../../utils/appinsights";
import { PermanentError } from "../../utils/errors";
import { contextMock } from "../__mocks__/azurefunctions.mock";
import {
  aFiscalCode,
  aMixedSingleChuckAsyncIterable,
  aMultiChuckAsyncIterable,
  anEmptyAsyncIterable,
  anExpiredAt,
  aSingleChuckAsyncIterable,
  aSingleInvalidItemAsyncIterable,
  aTimestamp,
  mockSessionNotificationsRepository,
  validSessionNotifications
} from "../__mocks__/session-notifications-repository.mock";
import { SessionNotificationEventsProcessorFunction } from "../session-notification-events-processor";

const anError = new Error("Simulated failure");

const aValidServiceBusLoginEventMessage: LoginEvent = ({
  eventType: EventTypeEnum.LOGIN,
  fiscalCode: aFiscalCode,
  expiredAt: anExpiredAt.getTime(),
  loginType: LoginTypeEnum.LV,
  scenario: LoginScenarioEnum.STANDARD,
  idp: "idp.example.com",
  ts: aTimestamp.getTime()
} as unknown) as LoginEvent;

const aValidServiceBusLogoutEventMessage: LogoutEvent = ({
  eventType: EventTypeEnum.LOGOUT,
  fiscalCode: aFiscalCode,
  scenario: LogoutScenarioEnum.APP,
  ts: aTimestamp.getTime()
} as unknown) as LogoutEvent;

const sessionNotificationEventsProcessorConfigMock = {
  SERVICEBUS_NOTIFICATION_EVENT_SUBSCRIPTION_MAX_DELIVERY_COUNT: 10
} as SessionNotificationEventsProcessorConfig;

const sessionNotificationsRepositoryConfigMock = {
  SESSION_NOTIFICATION_EVENTS_TTL_OFFSET: 432000, // 5 days in seconds
  SESSION_NOTIFICATION_EVENTS_FETCH_CHUNK_SIZE: 100
} as SessionNotificationsRepositoryConfig;

const mockSessionsNotificationModel = ({
  buildAsyncIterable: vi.fn(),
  patch: vi.fn(),
  create: vi.fn(),
  delete: vi.fn()
} as unknown) as SessionNotificationsModel;

const SessionNotificationsRepo = mockSessionNotificationsRepository;

const deps = {
  sessionNotificationEventsProcessorConfig: sessionNotificationEventsProcessorConfigMock,
  sessionNotificationsRepositoryConfig: sessionNotificationsRepositoryConfigMock,
  SessionNotificationsRepo: (SessionNotificationsRepo as unknown) as SessionNotificationsRepository,
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
    it("should process the event succesfully removing the previous cosmosDB record when present", async () => {
      await expect(
        SessionNotificationEventsProcessorFunction(deps)(
          serviceBusTriggerContextMock,
          aValidServiceBusLoginEventMessage
        )
      ).resolves.not.toThrow();

      expect(trackEventMock).not.toHaveBeenCalled();
      expect(
        SessionNotificationsRepo.findByFiscalCodeAsyncIterable
      ).toHaveBeenCalledWith(aValidServiceBusLoginEventMessage.fiscalCode);
      expect(SessionNotificationsRepo.deleteRecord).toHaveBeenCalledOnce();
      expect(SessionNotificationsRepo.deleteRecord).toHaveBeenCalledWith(
        aValidServiceBusLoginEventMessage.fiscalCode,
        aValidServiceBusLoginEventMessage.expiredAt
      );
      expect(SessionNotificationsRepo.createRecord).toHaveBeenCalledOnce();
      expect(SessionNotificationsRepo.createRecord).toHaveBeenCalledWith(
        aValidServiceBusLoginEventMessage.fiscalCode,
        aValidServiceBusLoginEventMessage.expiredAt
      );
    });

    it("should process the event succesfully removing all the previous cosmosDB records(single chunck) when present", async () => {
      SessionNotificationsRepo.findByFiscalCodeAsyncIterable.mockReturnValueOnce(
        () => aSingleChuckAsyncIterable()
      );

      await expect(
        SessionNotificationEventsProcessorFunction(deps)(
          serviceBusTriggerContextMock,
          aValidServiceBusLoginEventMessage
        )
      ).resolves.not.toThrow();

      expect(trackEventMock).not.toHaveBeenCalled();
      expect(
        SessionNotificationsRepo.findByFiscalCodeAsyncIterable
      ).toHaveBeenCalledWith(aValidServiceBusLoginEventMessage.fiscalCode);
      expect(SessionNotificationsRepo.deleteRecord).toHaveBeenCalledTimes(2);
      expect(SessionNotificationsRepo.deleteRecord).toHaveBeenNthCalledWith(
        1,
        aValidServiceBusLoginEventMessage.fiscalCode,
        validSessionNotifications.expiredAt
      );
      expect(SessionNotificationsRepo.deleteRecord).toHaveBeenNthCalledWith(
        2,
        aValidServiceBusLoginEventMessage.fiscalCode,
        validSessionNotifications.expiredAt - 1
      );
      expect(SessionNotificationsRepo.createRecord).toHaveBeenCalledOnce();
      expect(SessionNotificationsRepo.createRecord).toHaveBeenCalledWith(
        aValidServiceBusLoginEventMessage.fiscalCode,
        aValidServiceBusLoginEventMessage.expiredAt
      );
    });

    it("should process the event succesfully removing all the previous cosmosDB records(multiple chunck) when present", async () => {
      SessionNotificationsRepo.findByFiscalCodeAsyncIterable.mockReturnValueOnce(
        () => aMultiChuckAsyncIterable()
      );

      await expect(
        SessionNotificationEventsProcessorFunction(deps)(
          serviceBusTriggerContextMock,
          aValidServiceBusLoginEventMessage
        )
      ).resolves.not.toThrow();

      expect(trackEventMock).not.toHaveBeenCalled();
      expect(
        SessionNotificationsRepo.findByFiscalCodeAsyncIterable
      ).toHaveBeenCalledWith(aValidServiceBusLoginEventMessage.fiscalCode);
      expect(SessionNotificationsRepo.deleteRecord).toHaveBeenCalledTimes(2);
      expect(SessionNotificationsRepo.deleteRecord).toHaveBeenNthCalledWith(
        1,
        aValidServiceBusLoginEventMessage.fiscalCode,
        validSessionNotifications.expiredAt
      );
      expect(SessionNotificationsRepo.deleteRecord).toHaveBeenNthCalledWith(
        2,
        aValidServiceBusLoginEventMessage.fiscalCode,
        validSessionNotifications.expiredAt - 1
      );
      expect(SessionNotificationsRepo.createRecord).toHaveBeenCalledOnce();
      expect(SessionNotificationsRepo.createRecord).toHaveBeenCalledWith(
        aValidServiceBusLoginEventMessage.fiscalCode,
        aValidServiceBusLoginEventMessage.expiredAt
      );
    });

    it("should process the event succesfully whitout removing previous cosmosDB records when not present", async () => {
      SessionNotificationsRepo.findByFiscalCodeAsyncIterable.mockReturnValueOnce(
        () => anEmptyAsyncIterable()
      );

      await expect(
        SessionNotificationEventsProcessorFunction(deps)(
          serviceBusTriggerContextMock,
          aValidServiceBusLoginEventMessage
        )
      ).resolves.not.toThrow();

      expect(trackEventMock).not.toHaveBeenCalled();
      expect(
        SessionNotificationsRepo.findByFiscalCodeAsyncIterable
      ).toHaveBeenCalledWith(aValidServiceBusLoginEventMessage.fiscalCode);
      expect(SessionNotificationsRepo.deleteRecord).not.toHaveBeenCalled();
      expect(SessionNotificationsRepo.createRecord).toHaveBeenCalledOnce();
      expect(SessionNotificationsRepo.createRecord).toHaveBeenCalledWith(
        aValidServiceBusLoginEventMessage.fiscalCode,
        aValidServiceBusLoginEventMessage.expiredAt
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
      expect(
        SessionNotificationsRepo.findByFiscalCodeAsyncIterable
      ).toHaveBeenCalledWith(aValidServiceBusLoginEventMessage.fiscalCode);
      expect(SessionNotificationsRepo.deleteRecord).toHaveBeenCalledOnce();
      expect(SessionNotificationsRepo.deleteRecord).toHaveBeenCalledWith(
        aValidServiceBusLoginEventMessage.fiscalCode,
        aValidServiceBusLoginEventMessage.expiredAt
      );
      expect(SessionNotificationsRepo.createRecord).not.toHaveBeenCalled();
    });

    it("should process the event succesfully removing all the previous cosmosDB records(single chunck) when present", async () => {
      SessionNotificationsRepo.findByFiscalCodeAsyncIterable.mockReturnValueOnce(
        () => aSingleChuckAsyncIterable()
      );

      await expect(
        SessionNotificationEventsProcessorFunction(deps)(
          serviceBusTriggerContextMock,
          aValidServiceBusLogoutEventMessage
        )
      ).resolves.not.toThrow();

      expect(trackEventMock).not.toHaveBeenCalled();
      expect(
        SessionNotificationsRepo.findByFiscalCodeAsyncIterable
      ).toHaveBeenCalledWith(aValidServiceBusLoginEventMessage.fiscalCode);
      expect(SessionNotificationsRepo.deleteRecord).toHaveBeenCalledTimes(2);
      expect(SessionNotificationsRepo.deleteRecord).toHaveBeenNthCalledWith(
        1,
        aValidServiceBusLoginEventMessage.fiscalCode,
        validSessionNotifications.expiredAt
      );
      expect(SessionNotificationsRepo.deleteRecord).toHaveBeenNthCalledWith(
        2,
        aValidServiceBusLoginEventMessage.fiscalCode,
        validSessionNotifications.expiredAt - 1
      );
      expect(SessionNotificationsRepo.createRecord).not.toHaveBeenCalled();
    });

    it("should process the event succesfully removing all the previous cosmosDB records(multiple chunck) when present", async () => {
      SessionNotificationsRepo.findByFiscalCodeAsyncIterable.mockReturnValueOnce(
        () => aMultiChuckAsyncIterable()
      );

      await expect(
        SessionNotificationEventsProcessorFunction(deps)(
          serviceBusTriggerContextMock,
          aValidServiceBusLogoutEventMessage
        )
      ).resolves.not.toThrow();

      expect(trackEventMock).not.toHaveBeenCalled();
      expect(
        SessionNotificationsRepo.findByFiscalCodeAsyncIterable
      ).toHaveBeenCalledWith(aValidServiceBusLoginEventMessage.fiscalCode);
      expect(SessionNotificationsRepo.deleteRecord).toHaveBeenCalledTimes(2);
      expect(SessionNotificationsRepo.deleteRecord).toHaveBeenNthCalledWith(
        1,
        aValidServiceBusLoginEventMessage.fiscalCode,
        validSessionNotifications.expiredAt
      );
      expect(SessionNotificationsRepo.deleteRecord).toHaveBeenNthCalledWith(
        2,
        aValidServiceBusLoginEventMessage.fiscalCode,
        validSessionNotifications.expiredAt - 1
      );
      expect(SessionNotificationsRepo.createRecord).not.toHaveBeenCalled();
    });

    it("should process the event succesfully whitout removing previous cosmosDB records when not present", async () => {
      // eslint-disable-next-line sonarjs/no-identical-functions
      SessionNotificationsRepo.findByFiscalCodeAsyncIterable.mockReturnValueOnce(
        () => anEmptyAsyncIterable()
      );

      await expect(
        SessionNotificationEventsProcessorFunction(deps)(
          serviceBusTriggerContextMock,
          aValidServiceBusLogoutEventMessage
        )
      ).resolves.not.toThrow();

      expect(trackEventMock).not.toHaveBeenCalled();
      expect(
        SessionNotificationsRepo.findByFiscalCodeAsyncIterable
      ).toHaveBeenCalledWith(aValidServiceBusLoginEventMessage.fiscalCode);
      expect(SessionNotificationsRepo.deleteRecord).not.toHaveBeenCalled();
      expect(SessionNotificationsRepo.createRecord).not.toHaveBeenCalled();
    });
  });

  describe("Transient and Permanent Errors Handling", () => {
    it("should throw on TransientError when an error occurred while finding previousEvents", async () => {
      SessionNotificationsRepo.findByFiscalCodeAsyncIterable.mockReturnValueOnce(
        (_deps: unknown) =>
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
      expect(
        SessionNotificationsRepo.findByFiscalCodeAsyncIterable
      ).toHaveBeenCalledWith(aValidServiceBusLoginEventMessage.fiscalCode);
      expect(SessionNotificationsRepo.deleteRecord).not.toHaveBeenCalled();
      expect(SessionNotificationsRepo.createRecord).not.toHaveBeenCalled();
    });

    it("should throw on TransientError while deleting previousEvents", async () => {
      const error = ({
        kind: "COSMOS_ERROR",
        error: anError
      } as unknown) as CosmosErrors;

      SessionNotificationsRepo.deleteRecord.mockReturnValueOnce(
        RTE.fromEither(E.left(error))
      );

      await expect(
        SessionNotificationEventsProcessorFunction(deps)(
          serviceBusTriggerContextMock,
          aValidServiceBusLoginEventMessage
        )
      ).rejects.toThrow(
        `An Error occurred while deleting previous records => ${error.kind}`
      );

      expect(trackEventMock).not.toHaveBeenCalled();
      expect(
        SessionNotificationsRepo.findByFiscalCodeAsyncIterable
      ).toHaveBeenCalledWith(aValidServiceBusLoginEventMessage.fiscalCode);
      expect(SessionNotificationsRepo.deleteRecord).toHaveBeenCalledOnce();
      expect(SessionNotificationsRepo.deleteRecord).toHaveBeenCalledWith(
        aValidServiceBusLoginEventMessage.fiscalCode,
        aValidServiceBusLoginEventMessage.expiredAt
      );
      expect(SessionNotificationsRepo.createRecord).not.toHaveBeenCalled();
    });

    it("should throw on TransientError while creating new record", async () => {
      const error = ({
        kind: "COSMOS_ERROR",
        error: anError
      } as unknown) as CosmosErrors;
      SessionNotificationsRepo.createRecord.mockReturnValueOnce(
        RTE.fromEither(E.left(error))
      );

      await expect(
        SessionNotificationEventsProcessorFunction(deps)(
          serviceBusTriggerContextMock,
          aValidServiceBusLoginEventMessage
        )
      ).rejects.toThrow(
        "An Error occurred while creating a new session record"
      );

      expect(trackEventMock).not.toHaveBeenCalled();

      expect(
        SessionNotificationsRepo.findByFiscalCodeAsyncIterable
      ).toHaveBeenCalledWith(aValidServiceBusLoginEventMessage.fiscalCode);
      expect(SessionNotificationsRepo.deleteRecord).toHaveBeenCalledOnce();
      expect(SessionNotificationsRepo.deleteRecord).toHaveBeenCalledWith(
        aValidServiceBusLoginEventMessage.fiscalCode,
        aValidServiceBusLoginEventMessage.expiredAt
      );
      expect(SessionNotificationsRepo.createRecord).toHaveBeenCalledOnce();
      expect(SessionNotificationsRepo.createRecord).toHaveBeenCalledWith(
        aValidServiceBusLoginEventMessage.fiscalCode,
        aValidServiceBusLoginEventMessage.expiredAt
      );
    });

    it("should not fail on Bad record received querying CosmosDB(only invalid item)", async () => {
      SessionNotificationsRepo.findByFiscalCodeAsyncIterable.mockReturnValueOnce(
        () => aSingleInvalidItemAsyncIterable()
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

      expect(
        SessionNotificationsRepo.findByFiscalCodeAsyncIterable
      ).toHaveBeenCalledWith(aValidServiceBusLoginEventMessage.fiscalCode);
      expect(SessionNotificationsRepo.deleteRecord).not.toHaveBeenCalled();

      expect(SessionNotificationsRepo.createRecord).toHaveBeenCalledOnce();
      expect(SessionNotificationsRepo.createRecord).toHaveBeenCalledWith(
        aValidServiceBusLoginEventMessage.fiscalCode,
        aValidServiceBusLoginEventMessage.expiredAt
      );
    });

    it("should not fail on Bad record received querying CosmosDB (mixed query results, valid and invalid items)", async () => {
      SessionNotificationsRepo.findByFiscalCodeAsyncIterable.mockReturnValueOnce(
        () => aMixedSingleChuckAsyncIterable()
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

      expect(
        SessionNotificationsRepo.findByFiscalCodeAsyncIterable
      ).toHaveBeenCalledWith(aValidServiceBusLoginEventMessage.fiscalCode);
      expect(SessionNotificationsRepo.deleteRecord).toHaveBeenCalledOnce();
      expect(SessionNotificationsRepo.deleteRecord).toHaveBeenCalledWith(
        aValidServiceBusLoginEventMessage.fiscalCode,
        aValidServiceBusLoginEventMessage.expiredAt
      );

      expect(SessionNotificationsRepo.createRecord).toHaveBeenCalledOnce();
      expect(SessionNotificationsRepo.createRecord).toHaveBeenCalledWith(
        aValidServiceBusLoginEventMessage.fiscalCode,
        aValidServiceBusLoginEventMessage.expiredAt
      );
    });

    it("should fail silently on PermanentError while creating new record(Bad TTL)", async () => {
      const permanentError = new PermanentError(
        "Unable to calculate New Record TTL, the reason was => value -1000 at root is not a valid [integer >= 0]"
      );

      SessionNotificationsRepo.createRecord.mockReturnValueOnce(
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

      expect(
        SessionNotificationsRepo.findByFiscalCodeAsyncIterable
      ).toHaveBeenCalledWith(aValidServiceBusLoginEventMessage.fiscalCode);
      expect(SessionNotificationsRepo.deleteRecord).toHaveBeenCalledOnce();
      expect(SessionNotificationsRepo.deleteRecord).toHaveBeenCalledWith(
        aValidServiceBusLoginEventMessage.fiscalCode,
        aValidServiceBusLoginEventMessage.expiredAt
      );

      expect(SessionNotificationsRepo.createRecord).toHaveBeenCalledOnce();
      expect(SessionNotificationsRepo.createRecord).toHaveBeenCalledWith(
        aValidServiceBusLoginEventMessage.fiscalCode,
        aValidServiceBusLoginEventMessage.expiredAt
      );
    });

    it("should emit a customEvent on TransientError and last retry", async () => {
      const error = ({
        kind: "COSMOS_ERROR",
        error: anError
      } as unknown) as CosmosErrors;
      SessionNotificationsRepo.createRecord.mockReturnValueOnce(
        RTE.fromEither(E.left(error))
      );

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

      expect(
        SessionNotificationsRepo.findByFiscalCodeAsyncIterable
      ).not.toHaveBeenCalled();
      expect(SessionNotificationsRepo.deleteRecord).not.toHaveBeenCalled();
      expect(SessionNotificationsRepo.createRecord).not.toHaveBeenCalled();
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

      expect(
        SessionNotificationsRepo.findByFiscalCodeAsyncIterable
      ).not.toHaveBeenCalled();
      expect(SessionNotificationsRepo.deleteRecord).not.toHaveBeenCalled();
      expect(SessionNotificationsRepo.createRecord).not.toHaveBeenCalled();
    });
  });
});
