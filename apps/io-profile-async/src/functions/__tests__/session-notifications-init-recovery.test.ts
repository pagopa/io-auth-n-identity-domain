/* eslint-disable max-lines-per-function */
import { ValidationError } from "@pagopa/handler-kit";
import { FiscalCode } from "@pagopa/ts-commons/lib/strings";
import * as E from "fp-ts/lib/Either";
import * as RTE from "fp-ts/lib/ReaderTaskEither";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CosmosErrors } from "@pagopa/io-functions-commons/dist/src/utils/cosmosdb_model";
import { SessionNotificationsRepositoryConfig } from "../../config";
import { Client as SessionManagerInternalClient } from "../../generated/definitions/sm-internal/client";
import { UserSessionInfo } from "../../generated/definitions/sm-internal/UserSessionInfo";
import { SessionNotificationsModel } from "../../models/session-notifications";
import { SessionNotificationsRepository } from "../../repositories/session-notifications";
import { ExpiredSessionAdvisorQueueMessage } from "../../types/expired-session-advisor-queue-message";
import * as appinsights from "../../utils/appinsights";
import { mockQueueHandlerInputMocks } from "../__mocks__/handler.mock";
import {
  anEmptyAsyncIterable,
  mockSessionNotificationsRepository
} from "../__mocks__/session-notifications-repository.mock";
import { SessionNotificationsInitRecoveryHandler } from "../session-notifications-init-recovery";
import { PermanentError, TransientError } from "../../utils/errors";
import { aValidationErrorWithoutValidation } from "../__mocks__/validation.mock";

const aFiscalCode = "BBBBBB00B00B000B" as FiscalCode;
const anExpiredAtDate = new Date();
const aValidQueueMessage = {
  fiscalCode: aFiscalCode,
  expiredAt: anExpiredAtDate.getTime()
};

// Response Mocks
const aValidGetSessionResponse: UserSessionInfo = {
  active: true
};

// API Client Methods Mocks
const getSessionMock = vi.fn(async () =>
  E.of({
    status: 200,
    value: aValidGetSessionResponse
  })
);

// Dependencies Mocks
const mockSessionManagerInternalClient = ({
  getSession: getSessionMock
} as unknown) as SessionManagerInternalClient;

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

const trackEventMock = vi.spyOn(appinsights, "trackEvent");

const makeHandlerInputs = (input: unknown) => ({
  ...mockQueueHandlerInputMocks(
    ExpiredSessionAdvisorQueueMessage,
    input as ExpiredSessionAdvisorQueueMessage
  ),
  sessionManagerInternalClient: mockSessionManagerInternalClient,
  sessionNotificationsRepositoryConfig: sessionNotificationsRepositoryConfigMock,
  SessionNotificationsRepo: (SessionNotificationsRepo as unknown) as SessionNotificationsRepository,
  sessionNotificationsModel: mockSessionsNotificationModel
});

describe("SessionNotificationsInitRecovery handler", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should succeed on user with an active session having no record on cosmosDB container", async () => {
    SessionNotificationsRepo.findByFiscalCodeAsyncIterable.mockReturnValueOnce(
      anEmptyAsyncIterable
    );

    const response = await SessionNotificationsInitRecoveryHandler({
      ...makeHandlerInputs(aValidQueueMessage)
    })();

    expect(E.isRight(response)).toBe(true);
    expect(getSessionMock).toHaveBeenCalledOnce();
    expect(getSessionMock).toHaveBeenCalledWith({
      fiscalCode: aValidQueueMessage.fiscalCode
    });

    expect(
      SessionNotificationsRepo.findByFiscalCodeAsyncIterable
    ).toHaveBeenCalledOnce();
    expect(
      SessionNotificationsRepo.findByFiscalCodeAsyncIterable
    ).toHaveBeenCalledWith(aValidQueueMessage.fiscalCode);

    expect(SessionNotificationsRepo.createRecord).toHaveBeenCalledOnce();
    expect(SessionNotificationsRepo.createRecord).toHaveBeenCalledWith(
      aValidQueueMessage.fiscalCode,
      aValidQueueMessage.expiredAt
    );
  });

  describe("Input Validation Failures", () => {
    it("should fail when a bad Message is received", async () => {
      const response = await SessionNotificationsInitRecoveryHandler({
        ...makeHandlerInputs({ badProp: "bad" })
      })();

      expect(response).toStrictEqual(aValidationErrorWithoutValidation);
      expect(getSessionMock).not.toHaveBeenCalled();
      expect(
        SessionNotificationsRepo.findByFiscalCodeAsyncIterable
      ).not.toHaveBeenCalled();
      expect(SessionNotificationsRepo.createRecord).not.toHaveBeenCalled();
    });

    it("should fail when a bad FiscalCode is received", async () => {
      const response = await SessionNotificationsInitRecoveryHandler({
        ...makeHandlerInputs({
          ...aValidQueueMessage,
          fiscalCode: "bad"
        })
      })();

      expect(response).toStrictEqual(aValidationErrorWithoutValidation);
      expect(getSessionMock).not.toHaveBeenCalled();
      expect(
        SessionNotificationsRepo.findByFiscalCodeAsyncIterable
      ).not.toHaveBeenCalled();
      expect(SessionNotificationsRepo.createRecord).not.toHaveBeenCalled();
    });

    it("should fail when a bad expiredAt is received", async () => {
      const response = await SessionNotificationsInitRecoveryHandler({
        ...makeHandlerInputs({
          ...aValidQueueMessage,
          expiredAt: "bad"
        })
      })();

      expect(response).toStrictEqual(aValidationErrorWithoutValidation);
      expect(getSessionMock).not.toHaveBeenCalled();
      expect(
        SessionNotificationsRepo.findByFiscalCodeAsyncIterable
      ).not.toHaveBeenCalled();
      expect(SessionNotificationsRepo.createRecord).not.toHaveBeenCalled();
    });
  });

  // This test is to check QueuePermanentError handling
  // on QueuePermanentError the response should be a right in order to not Retry the message
  describe("PermanentError", () => {
    const baseCustomEvent = {
      name:
        "io.citizen-auth.prof-async.session-notification-init-recovery.permanent",
      properties: {},
      tagOverrides: {
        samplingEnabled: "false"
      }
    };
    it("should fail silently on user without an active session with no error forwarded", async () => {
      getSessionMock.mockImplementationOnce(async () =>
        E.of({
          status: 200,
          value: { active: false }
        })
      );
      const response = await SessionNotificationsInitRecoveryHandler({
        ...makeHandlerInputs(aValidQueueMessage)
      })();

      expect(E.isRight(response)).toBe(true);
      expect(getSessionMock).toHaveBeenCalledOnce();
      expect(getSessionMock).toHaveBeenCalledWith({ fiscalCode: aFiscalCode });
      expect(
        SessionNotificationsRepo.findByFiscalCodeAsyncIterable
      ).not.toHaveBeenCalled();
      expect(SessionNotificationsRepo.createRecord).not.toHaveBeenCalled();
      expect(trackEventMock).toHaveBeenCalledOnce();
      expect(trackEventMock).toHaveBeenCalledWith({
        ...baseCustomEvent,
        properties: {
          message: "User has no active session"
        }
      });
    });

    it("should fail silently on user which has already a record on CosmosDB Container", async () => {
      const response = await SessionNotificationsInitRecoveryHandler({
        ...makeHandlerInputs(aValidQueueMessage)
      })();

      expect(E.isRight(response)).toBe(true);
      expect(getSessionMock).toHaveBeenCalledOnce();
      expect(getSessionMock).toHaveBeenCalledWith({ fiscalCode: aFiscalCode });

      expect(
        SessionNotificationsRepo.findByFiscalCodeAsyncIterable
      ).toHaveBeenCalledOnce();
      expect(
        SessionNotificationsRepo.findByFiscalCodeAsyncIterable
      ).toHaveBeenCalledWith(aValidQueueMessage.fiscalCode);

      expect(SessionNotificationsRepo.createRecord).not.toHaveBeenCalled();

      expect(trackEventMock).toHaveBeenCalledOnce();
      expect(trackEventMock).toHaveBeenCalledWith({
        ...baseCustomEvent,
        properties: {
          message: "User already has records in container"
        }
      });
    });

    it("should fail silently on PermanentError Creating new record", async () => {
      SessionNotificationsRepo.findByFiscalCodeAsyncIterable.mockReturnValueOnce(
        anEmptyAsyncIterable
      );
      const errorMessage =
        "Unable to calculate New Record TTL, the reason was => value -1000 at root is not a valid [integer >= 0]";

      SessionNotificationsRepo.createRecord.mockReturnValueOnce(
        RTE.fromEither(E.left(new PermanentError(errorMessage)))
      );

      const response = await SessionNotificationsInitRecoveryHandler({
        ...makeHandlerInputs(aValidQueueMessage)
      })();

      expect(E.isRight(response)).toBe(true);
      expect(getSessionMock).toHaveBeenCalledOnce();
      expect(getSessionMock).toHaveBeenCalledWith({ fiscalCode: aFiscalCode });

      expect(
        SessionNotificationsRepo.findByFiscalCodeAsyncIterable
      ).toHaveBeenCalledOnce();
      expect(
        SessionNotificationsRepo.findByFiscalCodeAsyncIterable
      ).toHaveBeenCalledWith(aValidQueueMessage.fiscalCode);

      expect(SessionNotificationsRepo.createRecord).toHaveBeenCalledOnce();
      expect(SessionNotificationsRepo.createRecord).toHaveBeenCalledWith(
        aValidQueueMessage.fiscalCode,
        aValidQueueMessage.expiredAt
      );

      expect(trackEventMock).toHaveBeenCalledOnce();
      expect(trackEventMock).toHaveBeenCalledWith({
        ...baseCustomEvent,
        properties: {
          message: errorMessage
        }
      });
    });
  });

  describe("TransientError", () => {
    it.each`
      scenario                        | mockedImpl                                               | expectedError
      ${"throw"}                      | ${new Error("Error")}                                    | ${"Error while calling the downstream component [retrieveSession]"}
      ${"return a Left"}              | ${E.left(new ValidationError(["aaaa"]))}                 | ${"Unexpected response from backend internal [retrieveSession]"}
      ${"return status code not 200"} | ${E.right({ ...aValidGetSessionResponse, status: 500 })} | ${"Error while retrieving user session: downstream component returned 500 [retrieveSession]"}
    `(
      "should return a TransientError when GetSession $scenario",
      async ({ mockedImpl, expectedError }) => {
        getSessionMock.mockImplementationOnce(async () => {
          if (mockedImpl instanceof Error) throw mockedImpl;
          return mockedImpl;
        });
        const response = await SessionNotificationsInitRecoveryHandler({
          ...makeHandlerInputs(aValidQueueMessage)
        })();

        expect(response).toStrictEqual(
          E.left(new TransientError(expectedError))
        );
        expect(getSessionMock).toHaveBeenCalledOnce();
        expect(getSessionMock).toHaveBeenCalledWith({
          fiscalCode: aValidQueueMessage.fiscalCode
        });
        expect(
          SessionNotificationsRepo.findByFiscalCodeAsyncIterable
        ).not.toHaveBeenCalled();
        expect(SessionNotificationsRepo.createRecord).not.toHaveBeenCalled();
      }
    );

    it("should return a TransientError when findByFiscalCodeAsyncIterable fails", async () => {
      SessionNotificationsRepo.findByFiscalCodeAsyncIterable.mockReturnValueOnce(
        (_deps: unknown) =>
          (async function*() {
            yield await Promise.reject(new Error("Simulated failure"));
          })()
      );
      const response = await SessionNotificationsInitRecoveryHandler({
        ...makeHandlerInputs(aValidQueueMessage)
      })();

      expect(
        E.left(
          new TransientError(
            "Error retrieving session expirations, AsyncIterable fetch execution failure"
          )
        )
      ).toStrictEqual(response);

      expect(getSessionMock).toHaveBeenCalledOnce();
      expect(getSessionMock).toHaveBeenCalledWith({ fiscalCode: aFiscalCode });

      expect(
        SessionNotificationsRepo.findByFiscalCodeAsyncIterable
      ).toHaveBeenCalledOnce();
      expect(
        SessionNotificationsRepo.findByFiscalCodeAsyncIterable
      ).toHaveBeenCalledWith(aValidQueueMessage.fiscalCode);

      expect(SessionNotificationsRepo.createRecord).not.toHaveBeenCalled();
      expect(trackEventMock).not.toHaveBeenCalled();
    });

    it("should return a TransientError when createRecord fails", async () => {
      SessionNotificationsRepo.findByFiscalCodeAsyncIterable.mockReturnValueOnce(
        anEmptyAsyncIterable
      );

      const error = ({
        kind: "COSMOS_ERROR",
        error: new Error("Simulated failure")
      } as unknown) as CosmosErrors;
      SessionNotificationsRepo.createRecord.mockReturnValueOnce(
        RTE.fromEither(E.left(error))
      );

      const response = await SessionNotificationsInitRecoveryHandler({
        ...makeHandlerInputs(aValidQueueMessage)
      })();

      expect(
        E.left(
          new TransientError(
            "An Error occurred while creating a new session record"
          )
        )
      ).toStrictEqual(response);

      expect(getSessionMock).toHaveBeenCalledOnce();
      expect(getSessionMock).toHaveBeenCalledWith({ fiscalCode: aFiscalCode });

      expect(
        SessionNotificationsRepo.findByFiscalCodeAsyncIterable
      ).toHaveBeenCalledOnce();
      expect(
        SessionNotificationsRepo.findByFiscalCodeAsyncIterable
      ).toHaveBeenCalledWith(aValidQueueMessage.fiscalCode);

      expect(SessionNotificationsRepo.createRecord).toHaveBeenCalledOnce();
      expect(SessionNotificationsRepo.createRecord).toHaveBeenCalledWith(
        aValidQueueMessage.fiscalCode,
        aValidQueueMessage.expiredAt
      );

      expect(trackEventMock).not.toHaveBeenCalled();
    });
  });
});
