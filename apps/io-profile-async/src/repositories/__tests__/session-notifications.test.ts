/* eslint-disable max-lines-per-function */
import { asyncIterableToArray } from "@pagopa/io-functions-commons/dist/src/utils/async";
import { CosmosErrors } from "@pagopa/io-functions-commons/dist/src/utils/cosmosdb_model";
import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";
import { FiscalCode, NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import * as E from "fp-ts/lib/Either";
import * as TE from "fp-ts/TaskEither";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SessionNotificationsRepositoryConfig } from "../../config";
import {
  RetrievedSessionNotifications,
  SESSION_NOTIFICATIONS_MODEL_KEY_FIELD,
  SESSION_NOTIFICATIONS_ROW_PK_FIELD,
  SessionNotifications,
  SessionNotificationsModel
} from "../../models/session-notifications";
import { Interval } from "../../types/interval";
import {
  Dependencies,
  SessionNotificationsRepository
} from "../session-notifications";

import { PermanentError } from "../../utils/errors";

const anId = "AAAAAA89S20I111X" as FiscalCode;
const anExpiredAt = new Date("2026-06-11T12:00:00Z");
const anExpiredAtTimestamp = anExpiredAt.getTime();
const aPreviousExpiredAt = new Date("2025-05-11T12:00:00Z");
const aTtl = 885551 as NonNegativeInteger;
const aYearInSeconds = 31536000; // 1 year in seconds

const aSessionNotifications = {
  id: (anId as unknown) as NonEmptyString,
  expiredAt: anExpiredAtTimestamp,
  notificationEvents: {},
  ttl: aTtl
} as SessionNotifications;

const cosmosMetadata = {
  _rid: "rid",
  _self: "self",
  _etag: "etag",
  _ts: 1693992855
};

const aRetrievedSessionNotifications = {
  ...aSessionNotifications,
  ...cosmosMetadata,
  kind: "IRetrievedSessionNotifications"
} as RetrievedSessionNotifications;

const asyncIterableMock = {
  [Symbol.asyncIterator]() {
    let called = false;
    return {
      next() {
        if (called) {
          return Promise.resolve({ done: true, value: undefined });
        }
        called = true;
        return Promise.resolve({
          done: false,
          value: {
            resources: [aRetrievedSessionNotifications]
          }
        });
      }
    };
  }
};

const mockCreate = vi.fn(
  (): TE.TaskEither<CosmosErrors, RetrievedSessionNotifications> =>
    TE.right(aRetrievedSessionNotifications)
);

const mockDelete = vi.fn(
  (): TE.TaskEither<CosmosErrors, void> => TE.right(void 0)
);

const mockPatch = vi.fn(
  (): TE.TaskEither<CosmosErrors, RetrievedSessionNotifications> =>
    TE.right(aRetrievedSessionNotifications)
);

const mockSessionNotificationsModel = ({
  buildAsyncIterable: vi.fn(() => asyncIterableMock),
  delete: mockDelete,
  create: mockCreate,
  patch: mockPatch
} as unknown) as SessionNotificationsModel;

const sessionNotificationsRepositoryConfigMock: SessionNotificationsRepositoryConfig = {
  SESSION_NOTIFICATION_EVENTS_TTL_OFFSET: 432000, // 5 days in seconds
  SESSION_NOTIFICATION_EVENTS_FETCH_CHUNK_SIZE: 1
};

const deps = {
  sessionNotificationsModel: mockSessionNotificationsModel,
  sessionNotificationsRepositoryConfig: sessionNotificationsRepositoryConfigMock
} as Dependencies;

describe("SessionNotificationsRepository", () => {
  const baseDate = new Date("2025-06-11T12:00:00Z");

  beforeEach(() => {
    vi.setSystemTime(baseDate);
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("findByExpiredAtAsyncIterable", () => {
    it("should call buildAsyncIterable with correct query and parameters", async () => {
      const interval: Interval = {
        from: new Date(2024, 0, 1),
        to: new Date(2024, 0, 2)
      };

      const result = await asyncIterableToArray(
        SessionNotificationsRepository.findByExpiredAtAsyncIterable(interval)(
          deps
        )
      );

      expect(
        mockSessionNotificationsModel.buildAsyncIterable
      ).toHaveBeenCalledWith(
        {
          parameters: [
            { name: "@from", value: interval.from.getTime() },
            { name: "@to", value: interval.to.getTime() }
          ],
          query:
            `SELECT * FROM c WHERE (c.${SESSION_NOTIFICATIONS_ROW_PK_FIELD} BETWEEN @from AND @to) AND ` +
            "(c.notificationEvents.EXPIRED_SESSION = false OR NOT IS_DEFINED(c.notificationEvents.EXPIRED_SESSION))"
        },
        sessionNotificationsRepositoryConfigMock.SESSION_NOTIFICATION_EVENTS_FETCH_CHUNK_SIZE
      );

      expect(result).toStrictEqual([[E.of(aRetrievedSessionNotifications)]]);
    });
  });

  describe("findByFiscalCodeAsyncIterable", () => {
    it("should call buildAsyncIterable with correct query and parameters", async () => {
      const result = await asyncIterableToArray(
        SessionNotificationsRepository.findByFiscalCodeAsyncIterable(anId)(deps)
      );

      expect(
        mockSessionNotificationsModel.buildAsyncIterable
      ).toHaveBeenCalledWith(
        {
          parameters: [{ name: "@fiscalCode", value: anId }],
          query: `SELECT * FROM c WHERE c.${SESSION_NOTIFICATIONS_MODEL_KEY_FIELD} = @fiscalCode`
        },
        sessionNotificationsRepositoryConfigMock.SESSION_NOTIFICATION_EVENTS_FETCH_CHUNK_SIZE
      );

      expect(result).toStrictEqual([[E.of(aRetrievedSessionNotifications)]]);
    });
  });

  describe("updateExpiredSessionNotificationFlag", () => {
    it("should update the EXPIRED_SESSION flag successfully", async () => {
      const result = await SessionNotificationsRepository.updateExpiredSessionNotificationFlag(
        anId,
        anExpiredAtTimestamp,
        true
      )(deps)();

      expect(mockPatch).toHaveBeenCalledWith([anId, anExpiredAtTimestamp], {
        notificationEvents: { EXPIRED_SESSION: true }
      });
      expect(E.isRight(result)).toBe(true);
    });

    it("should return a Cosmos error on failure", async () => {
      const error = ({
        kind: "COSMOS_ERROR",
        error: new Error("failure")
      } as unknown) as CosmosErrors;
      mockPatch.mockReturnValueOnce(TE.left(error));

      const result = await SessionNotificationsRepository.updateExpiredSessionNotificationFlag(
        anId,
        anExpiredAtTimestamp,
        true
      )(deps)();

      expect(mockPatch).toHaveBeenCalledWith([anId, anExpiredAtTimestamp], {
        notificationEvents: { EXPIRED_SESSION: true }
      });
      expect(E.isLeft(result)).toBe(true);
      expect(result).toEqual(E.left(error));
    });
  });

  describe("createRecord", () => {
    it("should create the record successfully", async () => {
      const result = await SessionNotificationsRepository.createRecord(
        anId,
        anExpiredAtTimestamp
      )(deps)();

      const expectedTtl =
        aYearInSeconds +
        sessionNotificationsRepositoryConfigMock.SESSION_NOTIFICATION_EVENTS_TTL_OFFSET;

      expect(mockCreate).toHaveBeenCalledWith({
        id: anId,
        expiredAt: anExpiredAtTimestamp,
        notificationEvents: {},
        ttl: expectedTtl,
        kind: "INewSessionNotifications"
      });
      expect(result).toEqual(E.right(void 0));
    });

    it("should return a Cosmos error on failure", async () => {
      const error = ({
        kind: "COSMOS_ERROR",
        error: new Error("failure")
      } as unknown) as CosmosErrors;

      mockCreate.mockReturnValueOnce(TE.left(error));

      const result = await SessionNotificationsRepository.createRecord(
        anId,
        anExpiredAtTimestamp
      )(deps)();

      const expectedTtl =
        aYearInSeconds +
        sessionNotificationsRepositoryConfigMock.SESSION_NOTIFICATION_EVENTS_TTL_OFFSET;

      expect(mockCreate).toHaveBeenCalledWith({
        id: anId,
        expiredAt: anExpiredAtTimestamp,
        notificationEvents: {},
        ttl: expectedTtl,
        kind: "INewSessionNotifications"
      });
      expect(result).toEqual(E.left(error));
    });

    it("should return a PermanentError when a Bad TTL is calculated", async () => {
      const result = await SessionNotificationsRepository.createRecord(
        anId,
        aPreviousExpiredAt.getTime()
      )(deps)();

      const expectedBadTtl =
        Math.floor((aPreviousExpiredAt.getTime() - baseDate.getTime()) / 1000) +
        sessionNotificationsRepositoryConfigMock.SESSION_NOTIFICATION_EVENTS_TTL_OFFSET;

      expect(mockCreate).not.toHaveBeenCalled();

      expect(result).toEqual(
        E.left(
          new PermanentError(
            `Unable to calculate New Record TTL, the reason was => value ${expectedBadTtl} at root is not a valid [integer >= 0]`
          )
        )
      );
    });
  });

  describe("deleteRecord", () => {
    it("should delete the record successfully", async () => {
      const result = await SessionNotificationsRepository.deleteRecord(
        anId,
        anExpiredAtTimestamp
      )(deps)();

      expect(mockDelete).toHaveBeenCalledWith([anId, anExpiredAtTimestamp]);
      expect(result).toEqual(E.right(void 0));
    });

    it("should return a Cosmos error on failure", async () => {
      const error = ({
        kind: "COSMOS_ERROR",
        error: new Error("failure")
      } as unknown) as CosmosErrors;

      mockDelete.mockReturnValueOnce(TE.left(error));

      const result = await SessionNotificationsRepository.deleteRecord(
        anId,
        anExpiredAtTimestamp
      )(deps)();

      expect(mockDelete).toHaveBeenCalledWith([anId, anExpiredAtTimestamp]);
      expect(result).toEqual(E.left(error));
    });
  });
});
