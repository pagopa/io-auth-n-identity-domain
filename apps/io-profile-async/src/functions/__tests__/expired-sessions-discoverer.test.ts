import { QueueClient } from "@azure/storage-queue";
import { CosmosErrors } from "@pagopa/io-functions-commons/dist/src/utils/cosmosdb_model";
import * as E from "fp-ts/Either";
import * as TE from "fp-ts/TaskEither";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ExpiredSessionDiscovererConfig } from "../../config";
import {
  RetrievedSessionNotifications,
  SessionNotificationsModel
} from "../../models/session-notifications";
import { ExpiredUserSessionsQueueRepository } from "../../repositories/expired-user-sessions-queue";
import { SessionNotificationsRepository } from "../../repositories/session-notifications";
import * as appinsights from "../../utils/appinsights";
import { TransientError } from "../../utils/errors";
import {
  ItemToProcess,
  processChunk,
  processItem
} from "../expired-sessions-discoverer";

// TODO: THIS TEST IS IN EARLY WIP STAGE

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
} as unknown) as RetrievedSessionNotifications;

const item = {
  itemTimeoutInSeconds: 5,
  queuePayload: {
    fiscalCode: aSession.id,
    expiredAt: new Date(aSession.expiredAt)
  },
  retrievedDbItem: aSession
} as ItemToProcess;

const expiredSessionsDiscovererConfMock = {
  EXPIRED_SESSION_ADVISOR_QUEUE: "aQueueName",
  EXPIRED_SESSION_SCANNER_CHUNK_SIZE: 1,
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
        mockSessionNotificationsRepository.updateExpiredSessionNotificationFlag
      ).toHaveBeenCalledWith(
        item.retrievedDbItem.id,
        item.retrievedDbItem.expiredAt,
        true
      );
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

    it("should fail when send to queue fails and flag revert fails", async () => {
      const anError = new Error("Send to queue failed");
      const aCosmosError = { kind: "COSMOS_ERROR_RESPONSE" } as CosmosErrors;

      updateExpiredSessionNotificationFlagMock
        .mockImplementationOnce(() => TE.of(void 0))
        .mockImplementationOnce(() => TE.left(aCosmosError));

      sendExpiredUserSessionMock.mockImplementationOnce(() => TE.left(anError));

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
      expect(E.isRight(result)).toBeTruthy();
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

    it("should succeed when a flag revert fails", async () => {
      // When a flag revert fails, the process should continue and
      // the error should be tracked, but not returned since the
      // process should not be started again in this case.
      const anError = new Error("Send to queue failed");
      const aCosmosError = { kind: "COSMOS_ERROR_RESPONSE" } as CosmosErrors;

      // Simulate an error while writing into the queue in the second item
      sendExpiredUserSessionMock
        .mockImplementationOnce(() => TE.of(void 0))
        .mockImplementationOnce(() => TE.left(anError))
        .mockImplementationOnce(() => TE.of(void 0));

      // The update of the flag should be successful when setting it to true
      // and should fail when reverting it to false
      updateExpiredSessionNotificationFlagMock
        .mockImplementationOnce(() => TE.of(void 0))
        .mockImplementationOnce(() => TE.of(void 0))
        .mockImplementationOnce(() => TE.of(void 0))
        .mockImplementationOnce(() => TE.left(aCosmosError));

      const chunk = [item, { ...item, shouldFail: false }, item];
      const result = await processChunk(chunk)(baseDeps)();

      expect(
        mockSessionNotificationsRepository.updateExpiredSessionNotificationFlag
      ).toHaveBeenCalledTimes(chunk.length + 1); // +1 for the flag revert
      expect(
        mockExpiredUserSessionsQueueRepository.sendExpiredUserSession
      ).toHaveBeenCalledTimes(chunk.length);
      expect(trackEventMock).toHaveBeenCalledOnce();

      expect(result).toStrictEqual(E.right(void 0));
    });
  });
});
