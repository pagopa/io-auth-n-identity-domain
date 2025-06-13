import { asyncIterableToArray } from "@pagopa/io-functions-commons/dist/src/utils/async";
import { CosmosErrors } from "@pagopa/io-functions-commons/dist/src/utils/cosmosdb_model";
import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";
import { FiscalCode, NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import * as E from "fp-ts/lib/Either";
import * as TE from "fp-ts/TaskEither";
import { beforeEach, describe, expect, it, vi } from "vitest";
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

const anId = "AAAAAA89S20I111X" as FiscalCode;
const anExpirationTimestamp = 1746992855578;
const aTtl = 885551 as NonNegativeInteger;

const aSessionNotifications = {
  id: (anId as unknown) as NonEmptyString,
  expiredAt: anExpirationTimestamp,
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

const deps = {
  sessionNotificationsModel: mockSessionNotificationsModel
} as Dependencies;

describe("SessionNotificationsRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("findByExpiredAtAsyncIterable", () => {
    it("should call buildAsyncIterable with correct query and parameters", async () => {
      const interval: Interval = {
        from: new Date(2024, 0, 1),
        to: new Date(2024, 0, 2)
      };
      const chunkSize = 100;

      const result = await asyncIterableToArray(
        SessionNotificationsRepository.findByExpiredAtAsyncIterable(
          interval,
          chunkSize
        )(deps)
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
        chunkSize
      );

      expect(result).toStrictEqual([[E.of(aRetrievedSessionNotifications)]]);
    });
  });

  describe("findByFiscalCodeAsyncIterable", () => {
    it("should call buildAsyncIterable with correct query and parameters", async () => {
      const chunkSize = 100;

      const result = await asyncIterableToArray(
        SessionNotificationsRepository.findByFiscalCodeAsyncIterable(
          anId,
          chunkSize
        )(deps)
      );

      expect(
        mockSessionNotificationsModel.buildAsyncIterable
      ).toHaveBeenCalledWith(
        {
          parameters: [{ name: "@fiscalCode", value: anId }],
          query: `SELECT * FROM c WHERE c.${SESSION_NOTIFICATIONS_MODEL_KEY_FIELD} = @fiscalCode`
        },
        chunkSize
      );

      expect(result).toStrictEqual([[E.of(aRetrievedSessionNotifications)]]);
    });
  });

  describe("updateExpiredSessionNotificationFlag", () => {
    it("should update the EXPIRED_SESSION flag successfully", async () => {
      const result = await SessionNotificationsRepository.updateExpiredSessionNotificationFlag(
        anId,
        anExpirationTimestamp,
        true
      )(deps)();

      expect(mockPatch).toHaveBeenCalledWith([anId, anExpirationTimestamp], {
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
        anExpirationTimestamp,
        true
      )(deps)();

      expect(mockPatch).toHaveBeenCalledWith([anId, anExpirationTimestamp], {
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
        anExpirationTimestamp,
        aTtl
      )(deps)();

      expect(mockCreate).toHaveBeenCalledWith({
        id: anId,
        expiredAt: anExpirationTimestamp,
        notificationEvents: {},
        ttl: aTtl,
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
        anExpirationTimestamp,
        aTtl
      )(deps)();

      expect(mockCreate).toHaveBeenCalledWith({
        id: anId,
        expiredAt: anExpirationTimestamp,
        notificationEvents: {},
        ttl: aTtl,
        kind: "INewSessionNotifications"
      });
      expect(result).toEqual(E.left(error));
    });
  });

  describe("deleteRecord", () => {
    it("should delete the record successfully", async () => {
      const result = await SessionNotificationsRepository.deleteRecord(
        anId,
        anExpirationTimestamp
      )(deps)();

      expect(mockDelete).toHaveBeenCalledWith([anId, anExpirationTimestamp]);
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
        anExpirationTimestamp
      )(deps)();

      expect(mockDelete).toHaveBeenCalledWith([anId, anExpirationTimestamp]);
      expect(result).toEqual(E.left(error));
    });
  });
});
