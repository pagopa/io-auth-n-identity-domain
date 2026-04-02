/* eslint-disable max-lines-per-function */
/* eslint-disable functional/immutable-data */
import { QueueClient } from "@azure/storage-queue";
import { CosmosErrors } from "@pagopa/io-functions-commons/dist/src/utils/cosmosdb_model";
import * as E from "fp-ts/Either";
import * as TE from "fp-ts/TaskEither";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ExpiredSessionDiscovererConfig,
  SessionNotificationsRepositoryConfig,
} from "../../config";
import { SessionNotificationsModel } from "../../models/session-notifications";
import { ExpiredUserSessionsQueueRepository } from "../../repositories/expired-user-sessions-queue";
import { SessionNotificationsRepository } from "../../repositories/session-notifications";
import { createInterval } from "../../types/interval";
import { ExpiredSessionsDiscovererQueueMessage } from "../../types/expired-sessions-discoverer-queue-message";
import { RetrievedSessionNotificationsStrict } from "../../types/session-notification-strict";
import * as appinsights from "../../utils/appinsights";
import { mockQueueHandlerInputMocks } from "../__mocks__/handler.mock";
import { makeHandler } from "../expired-sessions-discoverer-maintenance";

const aSession = {
  id: "AAAAAA89S20I111X",
  expiredAt: Date.now(),
  notificationEvents: {
    EXPIRED_SESSION: false,
  },
  _etag: "etag",
  _rid: "rid",
  _self: "self",
  _ts: 0,
  kind: "IRetrievedSessionNotifications",
} as unknown as RetrievedSessionNotificationsStrict;

const sessionNotificationsRepositoryConfigMock = {
  SESSION_NOTIFICATION_EVENTS_TTL_OFFSET: 432000,
  SESSION_NOTIFICATION_EVENTS_FETCH_CHUNK_SIZE: 1,
} as SessionNotificationsRepositoryConfig;

const expiredSessionsDiscovererConfMock = {
  EXPIRED_SESSION_ADVISOR_QUEUE: "aQueueName",
  EXPIRED_SESSION_SCANNER_TIMEOUT_MULTIPLIER: 1,
  EXPIRED_SESSIONS_DISCOVERER_MAINTENANCE_QUEUE: "maintenanceQueueName",
  SESSION_NOTIFICATIONS_CONTAINER_NAME: "aContainerName",
} as ExpiredSessionDiscovererConfig;

const sendExpiredUserSessionMock = vi.fn(
  () => TE.of(void 0) as TE.TaskEither<Error, void>,
);

const updateExpiredSessionNotificationFlagMock = vi.fn(
  () => TE.of(void 0) as TE.TaskEither<CosmosErrors, void>,
);

const findByExpiredAtAsyncIterableMock = vi.fn(
  () =>
    async function* () {
      yield [E.of(aSession)];
    },
);

const mockExpiredUserSessionsQueueRepository = {
  sendExpiredUserSession: vi.fn(() => sendExpiredUserSessionMock),
} as unknown as ExpiredUserSessionsQueueRepository;

const mockSessionNotificationsRepository = {
  updateExpiredSessionNotificationFlag: vi.fn(
    () => updateExpiredSessionNotificationFlagMock,
  ),
  findByExpiredAtAsyncIterable: findByExpiredAtAsyncIterableMock,
} as unknown as SessionNotificationsRepository;

const mockSessionsNotificationModel = {
  buildAsyncIterable: vi.fn(),
  patch: vi.fn(),
} as unknown as SessionNotificationsModel;

const mockExpiredUserSessionsQueueClient = {
  sendMessage: vi.fn(),
} as unknown as QueueClient;

const baseDeps = {
  expiredSessionsDiscovererConf: expiredSessionsDiscovererConfMock,
  sessionNotificationsRepositoryConfig:
    sessionNotificationsRepositoryConfigMock,
  ExpiredUserSessionsQueueRepo: mockExpiredUserSessionsQueueRepository,
  SessionNotificationsRepo: mockSessionNotificationsRepository,
  sessionNotificationsModel: mockSessionsNotificationModel,
  expiredUserSessionsQueueClient: mockExpiredUserSessionsQueueClient,
};

const trackEventMock = vi.spyOn(appinsights, "trackEvent");

describe("ExpiredSessionsDiscovererMaintenanceFunction", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should process expired sessions for the given date", async () => {
    const targetDate = new Date("2025-06-15T00:00:00.000Z");

    const chunks = 1;
    const chunkSize = 2;
    findByExpiredAtAsyncIterableMock.mockImplementationOnce(
      () =>
        async function* () {
          for (let i = 0; i < chunks; i++) {
            yield Array(chunkSize).fill(E.of(aSession));
          }
        },
    );

    const handler = makeHandler({
      ...mockQueueHandlerInputMocks(ExpiredSessionsDiscovererQueueMessage, {
        date: targetDate,
      }),
      ...baseDeps,
    });
    const result = await handler();

    expect(E.isRight(result)).toBe(true);
    expect(findByExpiredAtAsyncIterableMock).toHaveBeenCalledWith(
      createInterval(targetDate),
    );
    expect(updateExpiredSessionNotificationFlagMock).toHaveBeenCalledTimes(
      chunkSize * chunks,
    );
    expect(sendExpiredUserSessionMock).toHaveBeenCalledTimes(
      chunkSize * chunks,
    );
    expect(trackEventMock).not.toHaveBeenCalled();
  });

  it("should return a left with QueueTransientError when processing fails", async () => {
    const targetDate = new Date("2025-06-15T00:00:00.000Z");

    const aCosmosError = { kind: "COSMOS_ERROR_RESPONSE" } as CosmosErrors;
    updateExpiredSessionNotificationFlagMock.mockImplementation(() =>
      TE.left(aCosmosError),
    );

    const handler = makeHandler({
      ...mockQueueHandlerInputMocks(ExpiredSessionsDiscovererQueueMessage, {
        date: targetDate,
      }),
      ...baseDeps,
    });
    const result = await handler();

    expect(E.isLeft(result)).toBe(true);
    expect(trackEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "io.citizen-auth.prof-async.expired-sessions-discoverer.transient",
        properties: expect.objectContaining({
          message: expect.stringContaining(aCosmosError.kind),
          interval: expect.objectContaining({
            from: expect.any(Date),
            to: expect.any(Date),
          }),
        }),
        tagOverrides: {
          samplingEnabled: "false",
        },
      }),
    );
  });
});
