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
import { processItem } from "../expired-sessions-discoverer";

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
};

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

describe("Expired Sessions Discoverer TimerTrigger Tests", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("processItem", () => {
    it("should succed when both flag update and write on queue end up succesfully", async () => {
      const result = await processItem(item)(baseDeps)();
      //TODO: add expects on methods invocations
      expect(E.isRight(result)).toBe(true);
      expect(trackEventMock).not.toHaveBeenCalled();
    });

    it("should fail when flag update fails", async () => {
      const aCosmosError = { kind: "COSMOS_ERROR_RESPONSE" } as CosmosErrors;

      updateExpiredSessionNotificationFlagMock.mockImplementationOnce(() =>
        TE.left(aCosmosError)
      );
      const result = await processItem(item)(baseDeps)();
      //TODO: add expects on methods invocations
      expect(result).toStrictEqual(
        E.left(
          new TransientError(
            `Error updating expired session flag(EXPIRED_SESSION): ${aCosmosError.kind}`
          )
        )
      );
    });

    it("should fail when send queue fails and revert fails", async () => {
      const anError = new Error("Send to queue failed");
      const aCosmosError = { kind: "COSMOS_ERROR_RESPONSE" } as CosmosErrors;

      updateExpiredSessionNotificationFlagMock
        .mockImplementationOnce(() => TE.of(void 0))
        .mockImplementationOnce(() => TE.left(aCosmosError));

      sendExpiredUserSessionMock.mockImplementationOnce(() => TE.left(anError));

      const result = await processItem(item)(baseDeps)();
      //TODO: add expects on methods invocations
      expect(E.isRight(result)).toBeTruthy();
    });

    //TODO: test other functions
  });
});
