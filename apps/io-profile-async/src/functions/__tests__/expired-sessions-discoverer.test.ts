/* eslint-disable max-lines-per-function */
/* eslint-disable functional/no-let */
/* eslint-disable functional/immutable-data */
import { Context } from "@azure/functions";
import { QueueClient } from "@azure/storage-queue";
import { CosmosErrors } from "@pagopa/io-functions-commons/dist/src/utils/cosmosdb_model";
import * as E from "fp-ts/Either";
import * as TE from "fp-ts/TaskEither";
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from "vitest";
import {
  ExpiredSessionDiscovererConfig,
  SessionNotificationsRepositoryConfig
} from "../../config";
import { SessionNotificationsModel } from "../../models/session-notifications";
import { ExpiredUserSessionsQueueRepository } from "../../repositories/expired-user-sessions-queue";
import { SessionNotificationsRepository } from "../../repositories/session-notifications";
import { createInterval, Interval } from "../../types/interval";
import { RetrievedSessionNotificationsStrict } from "../../types/session-notification-strict";
import * as appinsights from "../../utils/appinsights";
import { TransientError } from "../../utils/errors";
import { aValidationError } from "../__mocks__/expired-sessions.mock";
import {
  ExpiredSessionsDiscovererFunction,
  getDate,
  ItemToProcess,
  processChunk,
  processItem,
  retrieveFromDbInChunks,
  trackTransientErrors
} from "../expired-sessions-discoverer";

const getDateError =
  "Invalid date provided in context for expired sessions discoverer timer";

const aSession = ({
  id: "AAAAAA89S20I111X",
  expiredAt: Date.now(),
  notificationEvents: {
    EXPIRED_SESSION: false
  },
  _etag: "etag",
  _rid: "rid",
  _self: "self",
  _ts: 0,
  kind: "IRetrievedSessionNotifications"
} as unknown) as RetrievedSessionNotificationsStrict;

const item: ItemToProcess = {
  itemTimeoutInSeconds: 5,
  queuePayload: {
    fiscalCode: aSession.id,
    expiredAt: new Date(aSession.expiredAt)
  },
  retrievedDbItem: aSession
};

const sessionNotificationsRepositoryConfigMock = {
  SESSION_NOTIFICATION_EVENTS_TTL_OFFSET: 432000, // 5 days in seconds
  SESSION_NOTIFICATION_EVENTS_FETCH_CHUNK_SIZE: 1
} as SessionNotificationsRepositoryConfig;

const expiredSessionsDiscovererConfMock = {
  EXPIRED_SESSION_ADVISOR_QUEUE: "aQueueName",
  EXPIRED_SESSION_SCANNER_TIMEOUT_MULTIPLIER: 1,
  SESSION_NOTIFICATIONS_CONTAINER_NAME: "aContainerName"
} as ExpiredSessionDiscovererConfig;

const sendExpiredUserSessionMock = vi.fn(
  () => TE.of(void 0) as TE.TaskEither<Error, void>
);

const updateExpiredSessionNotificationFlagMock = vi.fn(
  () => TE.of(void 0) as TE.TaskEither<CosmosErrors, void>
);

const findByExpiredAtAsyncIterableMock = vi.fn(
  () =>
    async function*() {
      yield [E.of(aSession)];
    }
);

const mockExpiredUserSessionsQueueRepository = ({
  sendExpiredUserSession: vi.fn(() => sendExpiredUserSessionMock)
} as unknown) as ExpiredUserSessionsQueueRepository;

const mockSessionNotificationsRepository = ({
  updateExpiredSessionNotificationFlag: vi.fn(
    () => updateExpiredSessionNotificationFlagMock
  ),
  findByExpiredAtAsyncIterable: findByExpiredAtAsyncIterableMock
} as unknown) as SessionNotificationsRepository;

const mockSessionsNotificationModel = ({
  buildAsyncIterable: vi.fn(),
  patch: vi.fn()
} as unknown) as SessionNotificationsModel;

const mockExpiredUserSessionsQueueClient = ({
  sendMessage: vi.fn()
} as unknown) as QueueClient;

const baseDeps = {
  expiredSessionsDiscovererConf: expiredSessionsDiscovererConfMock,
  sessionNotificationsRepositoryConfig: sessionNotificationsRepositoryConfigMock,
  ExpiredUserSessionsQueueRepo: mockExpiredUserSessionsQueueRepository,
  SessionNotificationsRepo: mockSessionNotificationsRepository,
  sessionNotificationsModel: mockSessionsNotificationModel,
  expiredUserSessionsQueueClient: mockExpiredUserSessionsQueueClient
};

const trackEventMock = vi.spyOn(appinsights, "trackEvent");

// eslint-disable-next-line max-lines-per-function
describe("Expired Sessions Discoverer TimerTrigger Tests", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("processItem", () => {
    const queueInsertError = new Error("Send to queue failed");

    it("should succeed when both the flag update and the write to the queue end successfully", async () => {
      const result = await processItem(item)(baseDeps)();

      expect(
        mockSessionNotificationsRepository.updateExpiredSessionNotificationFlag
      ).toHaveBeenCalledWith(
        item.retrievedDbItem.id,
        item.retrievedDbItem.expiredAt,
        true
      );
      // Nested call from `sendMessage` function invocation
      expect(
        mockExpiredUserSessionsQueueRepository.sendExpiredUserSession
      ).toHaveBeenCalledWith(item.queuePayload, item.itemTimeoutInSeconds);
      expect(E.isRight(result)).toBe(true);
      expect(trackEventMock).not.toHaveBeenCalled();
    });

    it("should fail when the flag update fails", async () => {
      const aCosmosError = { kind: "COSMOS_ERROR_RESPONSE" } as CosmosErrors;

      updateExpiredSessionNotificationFlagMock.mockImplementationOnce(() =>
        TE.left(aCosmosError)
      );
      const result = await processItem(item)(baseDeps)();

      expect(
        mockExpiredUserSessionsQueueRepository.sendExpiredUserSession
      ).not.toHaveBeenCalled();
      expect(result).toStrictEqual(
        E.left(
          new TransientError(
            `Error updating expired session flag(EXPIRED_SESSION): ${aCosmosError.kind}`
          )
        )
      );
    });

    it("should fail with a transient error when sending to the queue fails", async () => {
      sendExpiredUserSessionMock.mockImplementationOnce(() =>
        TE.left(queueInsertError)
      );

      const result = await processItem(item)(baseDeps)();

      // Expect the flag to be set to true
      expect(
        mockSessionNotificationsRepository.updateExpiredSessionNotificationFlag
      ).toHaveBeenCalledWith(
        item.retrievedDbItem.id,
        item.retrievedDbItem.expiredAt,
        true
      );

      // Failing call
      expect(
        mockExpiredUserSessionsQueueRepository.sendExpiredUserSession
      ).toHaveBeenCalled();

      // Revert the flag to false
      expect(
        mockSessionNotificationsRepository.updateExpiredSessionNotificationFlag
      ).toHaveBeenCalledWith(
        item.retrievedDbItem.id,
        item.retrievedDbItem.expiredAt,
        false
      );
      expect(result).toStrictEqual(
        E.left(
          new TransientError(
            "An error has occurred while sending message in queue"
          )
        )
      );
    });

    it("should handle a fatal error by raising a not-sampled custom event", async () => {
      const aCosmosError = { kind: "COSMOS_ERROR_RESPONSE" } as CosmosErrors;

      updateExpiredSessionNotificationFlagMock
        .mockImplementationOnce(() => TE.of(void 0))
        .mockImplementationOnce(() => TE.left(aCosmosError));

      sendExpiredUserSessionMock.mockImplementationOnce(() =>
        TE.left(queueInsertError)
      );

      const result = await processItem(item)(baseDeps)();
      expect(
        mockSessionNotificationsRepository.updateExpiredSessionNotificationFlag
      ).toHaveBeenNthCalledWith(
        1,
        item.retrievedDbItem.id,
        item.retrievedDbItem.expiredAt,
        true
      );
      expect(
        mockExpiredUserSessionsQueueRepository.sendExpiredUserSession
      ).toHaveBeenCalledWith(item.queuePayload, item.itemTimeoutInSeconds);
      expect(
        mockSessionNotificationsRepository.updateExpiredSessionNotificationFlag
      ).toHaveBeenNthCalledWith(
        2,
        item.retrievedDbItem.id,
        item.retrievedDbItem.expiredAt,
        false
      );
      expect(trackEventMock).toHaveBeenCalledWith({
        name:
          "io.citizen-auth.prof-async.expired-sessions-discoverer.permanent.revert-failure",
        properties: {
          // eslint-disable-next-line no-underscore-dangle
          itemDbSelf: item.retrievedDbItem._self,
          message:
            "Error reverting expired session flag(EXPIRED_SESSION) after Queue write failure"
        },
        tagOverrides: {
          samplingEnabled: "false"
        }
      });
      expect(E.isRight(result)).toBe(true);
    });
  });

  describe("processChunk", () => {
    it("should succeed when processItem succeed on each item", async () => {
      const chunk = [item, item, item];
      const result = await processChunk(chunk)(baseDeps)();

      expect(
        mockSessionNotificationsRepository.updateExpiredSessionNotificationFlag
      ).toHaveBeenCalledTimes(chunk.length);
      expect(
        mockExpiredUserSessionsQueueRepository.sendExpiredUserSession
      ).toHaveBeenCalledTimes(chunk.length);

      expect(result).toStrictEqual(E.right(void 0));
    });

    it("should fail when processItem fails on an item", async () => {
      const aCosmosError = { kind: "COSMOS_ERROR_RESPONSE" } as CosmosErrors;

      updateExpiredSessionNotificationFlagMock.mockImplementationOnce(() =>
        TE.left(aCosmosError)
      );

      const chunk = [item, item, item];
      const result = await processChunk(chunk)(baseDeps)();

      expect(
        mockSessionNotificationsRepository.updateExpiredSessionNotificationFlag
      ).toHaveBeenCalledTimes(chunk.length);
      expect(
        mockExpiredUserSessionsQueueRepository.sendExpiredUserSession
      ).toHaveBeenCalledTimes(chunk.length - 1); // -1 for the failed item
      expect(trackEventMock).not.toHaveBeenCalled();

      expect(result).toStrictEqual(
        E.left([
          new TransientError(
            `Error updating expired session flag(EXPIRED_SESSION): ${aCosmosError.kind}`
          )
        ])
      );
    });

    it("should fail when processItem fails on some items, reporting the errors", async () => {
      const aCosmosError = { kind: "COSMOS_ERROR_RESPONSE" } as CosmosErrors;

      updateExpiredSessionNotificationFlagMock
        .mockImplementationOnce(() => TE.left(aCosmosError))
        .mockImplementationOnce(() => TE.left(aCosmosError));

      const chunk = [item, item, item];
      const result = await processChunk(chunk)(baseDeps)();

      expect(
        mockSessionNotificationsRepository.updateExpiredSessionNotificationFlag
      ).toHaveBeenCalledTimes(chunk.length);
      expect(
        mockExpiredUserSessionsQueueRepository.sendExpiredUserSession
      ).toHaveBeenCalledTimes(chunk.length - 2); // -2 for the failed items
      expect(trackEventMock).not.toHaveBeenCalled();

      expect(result).toStrictEqual(
        E.left([
          new TransientError(
            `Error updating expired session flag(EXPIRED_SESSION): ${aCosmosError.kind}`
          ),
          new TransientError(
            `Error updating expired session flag(EXPIRED_SESSION): ${aCosmosError.kind}`
          )
        ])
      );
    });
  });

  describe("retrieveFromDbInChunks", () => {
    it("should return chunks of ItemToProcess", async () => {
      const chunkSize = 5;
      findByExpiredAtAsyncIterableMock.mockImplementationOnce(
        () =>
          async function*() {
            yield Array(chunkSize).fill(E.of(aSession));
          }
      );
      const deps = {
        ...baseDeps,
        sessionNotificationsRepositoryConfig: {
          ...baseDeps.sessionNotificationsRepositoryConfig,
          SESSION_NOTIFICATION_EVENTS_FETCH_CHUNK_SIZE: chunkSize
        }
      };

      const result = await retrieveFromDbInChunks(
        createInterval(new Date("2025-01-01"))
      )(deps)();

      expect(findByExpiredAtAsyncIterableMock).toHaveBeenCalledOnce();
      expect(findByExpiredAtAsyncIterableMock).toHaveBeenCalledWith({
        from: new Date("2024-12-31"),
        to: new Date("2025-01-01")
      } as Interval);

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        // Expecting a single chunk of size CHUNK_SIZE
        const chunks = result.right;
        expect(chunks).toHaveLength(1);
        expect(chunks[0]).toHaveLength(chunkSize);
        expect(chunks[0][0].itemTimeoutInSeconds).toBe(0);
      }
    });

    it("should return a TransientError if asyncIterableToArray throws", async () => {
      findByExpiredAtAsyncIterableMock.mockImplementationOnce(
        () =>
          // eslint-disable-next-line require-yield
          async function*() {
            throw new Error("Async error");
          }
      );

      const result = await retrieveFromDbInChunks(createInterval())(baseDeps)();
      expect(result).toStrictEqual(
        E.left(
          new TransientError(
            "Error retrieving session expirations, AsyncIterable fetch execution failure"
          )
        )
      );
    });

    it("should map chunk items with correct timeout multiplier", async () => {
      const chunks = 3;
      findByExpiredAtAsyncIterableMock.mockImplementationOnce(
        () =>
          async function*() {
            for (let i = 0; i < chunks; i++) {
              yield Array(
                sessionNotificationsRepositoryConfigMock.SESSION_NOTIFICATION_EVENTS_FETCH_CHUNK_SIZE
              ).fill(E.of(aSession));
            }
          }
      );

      const result = await retrieveFromDbInChunks(createInterval())(baseDeps)();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        // Expecting 3 chunks of size 1
        const right = result.right;
        expect(right).toHaveLength(chunks);
        expect(right[0]).toHaveLength(
          sessionNotificationsRepositoryConfigMock.SESSION_NOTIFICATION_EVENTS_FETCH_CHUNK_SIZE
        );
        // expect the timeout to be the multiplier * index
        // eslint-disable-next-line functional/no-let
        for (let i = 0; i < right.length; i++) {
          // check the timeout for each item in the chunk
          for (const item of right[i]) {
            expect(item.itemTimeoutInSeconds).toBe(
              expiredSessionsDiscovererConfMock.EXPIRED_SESSION_SCANNER_TIMEOUT_MULTIPLIER *
                i
            );
          }
        }
      }
    });

    it("should handle malformed item", async () => {
      // Validation error

      findByExpiredAtAsyncIterableMock.mockImplementationOnce(
        () =>
          async function*() {
            yield [
              E.left(aValidationError) as E.Either<
                never,
                RetrievedSessionNotificationsStrict
              >
            ];
          }
      );

      const result = await retrieveFromDbInChunks(createInterval())(baseDeps)();

      expect(E.isRight(result)).toBe(true);
      // console.log(JSON.stringify(result, null, 4));
      expect(trackEventMock).toHaveBeenCalledWith({
        name:
          "io.citizen-auth.prof-async.expired-sessions-discoverer.permanent.bad-record",
        properties: {
          message: "Found a non compliant db record",
          badRecordSelf:
            typeof aValidationError[0].context[0].actual === "object" &&
            aValidationError[0].context[0].actual !== null &&
            "_self" in aValidationError[0].context[0].actual
              ? // eslint-disable-next-line no-underscore-dangle
                (aValidationError[0].context[0].actual as { _self: string })
                  ._self
              : undefined
        },
        tagOverrides: {
          samplingEnabled: "false"
        }
      });
    });
  });

  describe("ExpiredSessionsDiscovererFunction", () => {
    it("should process all chunks and succeed when all items succeed", async () => {
      const chunks = 2;
      const chunkSize = 3;
      findByExpiredAtAsyncIterableMock.mockImplementationOnce(
        () =>
          async function*() {
            for (let i = 0; i < chunks; i++) {
              yield Array(chunkSize).fill(E.of(aSession));
            }
          }
      );
      const deps = {
        ...baseDeps,
        sessionNotificationsRepositoryConfig: {
          ...baseDeps.sessionNotificationsRepositoryConfig,
          SESSION_NOTIFICATION_EVENTS_FETCH_CHUNK_SIZE: chunkSize
        }
      };

      const context = { invocationId: "test" } as Context;
      await expect(
        ExpiredSessionsDiscovererFunction(deps)(context, {})
      ).resolves.not.toThrow();

      expect(updateExpiredSessionNotificationFlagMock).toHaveBeenCalledTimes(
        chunkSize * chunks
      );
      expect(sendExpiredUserSessionMock).toHaveBeenCalledTimes(
        chunkSize * chunks
      );
      expect(trackEventMock).not.toHaveBeenCalled();
    });

    it("should throw and track event when more transient errors occurs", async () => {
      const chunkSize = 4;
      findByExpiredAtAsyncIterableMock.mockImplementationOnce(
        () =>
          async function*() {
            yield Array(chunkSize).fill(E.of(aSession));
          }
      );

      const deps = {
        ...baseDeps,
        sessionNotificationsRepositoryConfig: {
          ...baseDeps.sessionNotificationsRepositoryConfig,
          SESSION_NOTIFICATION_EVENTS_FETCH_CHUNK_SIZE: chunkSize
        }
      };

      const cosmosSimulatedErrors = [
        { kind: "COSMOS_ERROR_RESPONSE" },
        { kind: "COSMOS_DECODING_ERROR" }
      ] as CosmosErrors[];

      // Fail the first two updates
      updateExpiredSessionNotificationFlagMock
        .mockImplementationOnce(() => TE.left(cosmosSimulatedErrors[0]))
        .mockImplementationOnce(() => TE.left(cosmosSimulatedErrors[1]))
        .mockImplementation(() => TE.of(void 0));

      const context = {
        invocationId: "test",
        executionContext: {
          retryContext: { retryCount: 0, maxRetryCount: 5 }
        }
      } as Context;

      await expect(
        ExpiredSessionsDiscovererFunction(deps)(context, {})
      ).rejects.toThrow("One or more chunks failed during processing");

      expect(trackEventMock).toHaveBeenCalledTimes(2);

      cosmosSimulatedErrors.forEach(error => {
        expect(trackEventMock).toHaveBeenCalledWith(
          expect.objectContaining({
            name:
              "io.citizen-auth.prof-async.expired-sessions-discoverer.transient",
            properties: expect.objectContaining({
              message: expect.stringContaining(error.kind),
              interval: expect.objectContaining({
                from: expect.any(Date),
                to: expect.any(Date)
              })
            }),
            tagOverrides: {
              samplingEnabled: "false"
            }
          })
        );
      });
    });

    it("should track max retry event reached if isLastTimerTriggerRetry returns true", async () => {
      const aCosmosError = { kind: "COSMOS_ERROR_RESPONSE" } as CosmosErrors;
      updateExpiredSessionNotificationFlagMock.mockImplementation(() =>
        TE.left(aCosmosError)
      );

      const context = {
        invocationId: "test",
        executionContext: {
          retryContext: { retryCount: 5, maxRetryCount: 5 }
        }
      } as Context;

      await expect(
        ExpiredSessionsDiscovererFunction(baseDeps)(context, {})
      ).rejects.toThrow("One or more chunks failed during processing");

      expect(trackEventMock).toHaveBeenCalledTimes(2);
      expect(trackEventMock).toHaveBeenCalledWith(
        expect.objectContaining({
          name:
            "io.citizen-auth.prof-async.expired-sessions-discoverer.transient",
          properties: expect.objectContaining({
            message: expect.stringContaining(aCosmosError.kind),
            interval: expect.objectContaining({
              from: expect.any(Date),
              to: expect.any(Date)
            })
          }),
          tagOverrides: {
            samplingEnabled: "false"
          }
        })
      );
      expect(trackEventMock).toHaveBeenCalledWith(
        expect.objectContaining({
          name:
            "io.citizen-auth.prof-async.expired-sessions-discoverer.max-retry-reached",
          properties: expect.objectContaining({
            message: expect.stringContaining(
              "Reached max retry for expired sessions"
            ),
            interval: expect.objectContaining({
              from: expect.any(Date),
              to: expect.any(Date)
            })
          }),
          tagOverrides: {
            samplingEnabled: "false"
          }
        })
      );
    });

    it("should throw an invalid date is passed in a manual invocation", async () => {
      const invalidDate = "invalid-date";
      const context = ({
        invocationId: "test",
        bindingData: { expiredSessionsDiscovererTimer: { date: invalidDate } }
      } as unknown) as Context;

      await expect(
        ExpiredSessionsDiscovererFunction(baseDeps)(context, {})
      ).rejects.toThrow(new Error(getDateError));
    });
  });

  describe("extractDate", () => {
    const frozenDate = new Date("2025-10-01T00:00:00Z");

    beforeEach(() => {
      vi.clearAllMocks();
      vi.useFakeTimers({ now: frozenDate });
    });

    afterAll(() => {
      vi.useRealTimers();
    });

    it("should return the current date when no date is provided in context", () => {
      const context = { bindingData: {} } as Context;
      const result = getDate(context);
      expect(result).toEqual(E.right(frozenDate));
    });

    it("should return a right with the date passed as argument when a valid date is provided in context", () => {
      const date = new Date("2025-01-01");
      const context = ({
        bindingData: { expiredSessionsDiscovererTimer: { date } }
      } as unknown) as Context;
      const result = getDate(context);
      expect(result).toEqual(E.right(date));
    });

    it("should return the current date when date is null or undefined in context", () => {
      const contextWithNullDate = ({
        bindingData: { expiredSessionsDiscovererTimer: { date: null } }
      } as unknown) as Context;
      const contextWithUndefinedDate = ({
        bindingData: { expiredSessionsDiscovererTimer: {} }
      } as unknown) as Context;

      expect(getDate(contextWithNullDate)).toEqual(E.right(frozenDate));
      expect(getDate(contextWithUndefinedDate)).toEqual(E.right(frozenDate));
    });

    it("should return left when date is an empty string", () => {
      const context = ({
        bindingData: { expiredSessionsDiscovererTimer: { date: "" } }
      } as unknown) as Context;
      const result = getDate(context);
      expect(result).toEqual(E.left(new Error(getDateError)));
    });

    it("should return left when date is an invalid date string", () => {
      const context = ({
        bindingData: {
          expiredSessionsDiscovererTimer: { date: "invalid-date" }
        }
      } as unknown) as Context;
      const result = getDate(context);
      expect(result).toEqual(E.left(new Error(getDateError)));
    });
  });

  describe("trackTransientErrors", () => {
    it("should track a single transient error with correct properties", () => {
      const error = new TransientError("Test transient error");
      const interval = createInterval();

      trackTransientErrors(interval, error);

      expect(trackEventMock).toHaveBeenCalledWith(
        expect.objectContaining({
          name:
            "io.citizen-auth.prof-async.expired-sessions-discoverer.transient",
          properties: expect.objectContaining({
            message: expect.stringContaining(error.message),
            interval: expect.objectContaining({
              from: expect.any(Date),
              to: expect.any(Date)
            })
          }),
          tagOverrides: {
            samplingEnabled: "false"
          }
        })
      );
    });
  });
});
