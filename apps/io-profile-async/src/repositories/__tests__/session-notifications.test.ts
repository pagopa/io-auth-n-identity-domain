import { FeedResponse } from "@azure/cosmos";
import { FiscalCode } from "@pagopa/ts-commons/lib/strings";
import * as E from "fp-ts/lib/Either";
import * as TE from "fp-ts/TaskEither";
import * as t from "io-ts";
import { beforeEach, describe, expect, it, Mock, vi } from "vitest";
import {
  SESSION_NOTIFICATIONS_ROW_PK_FIELD,
  SessionNotificationsModel
} from "../../models/session-notifications";
import { Interval } from "../../types/interval";
import {
  Dependencies,
  SessionNotificationsRepository
} from "../session-notifications";

const anId = "AAAAAA89S20I111X" as FiscalCode;
const anExpirationTimestamp = 1746992855578;

const asyncIterableMock = {
  [Symbol.asyncIterator]() {
    return {
      next() {
        return Promise.resolve({ done: true, value: [] });
      }
    };
  }
};

const mockSessionNotificationsModel = ({
  buildAsyncIterable: vi.fn(() => asyncIterableMock),
  patch: vi.fn()
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

      SessionNotificationsRepository.findByExpiredAtAsyncIterable(
        interval,
        chunkSize
      )(deps);

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
    });
  });

  describe("updateExpiredSessionNotificationFlag", () => {
    it("should update the EXPIRED_SESSION flag successfully", async () => {
      (mockSessionNotificationsModel.patch as Mock).mockReturnValueOnce(
        TE.right(void 0)
      );

      const result = await SessionNotificationsRepository.updateExpiredSessionNotificationFlag(
        anId,
        anExpirationTimestamp,
        true
      )(deps)();

      expect(E.isRight(result)).toBe(true);
      expect(mockSessionNotificationsModel.patch).toHaveBeenCalledWith(
        [anId, anExpirationTimestamp],
        { notificationEvents: { EXPIRED_SESSION: true } }
      );
    });

    it("should return a Cosmos error on failure", async () => {
      const error = { kind: "COSMOS_ERROR", error: new Error("failure") };
      (mockSessionNotificationsModel.patch as Mock).mockReturnValueOnce(
        TE.left(error)
      );

      const result = await SessionNotificationsRepository.updateExpiredSessionNotificationFlag(
        anId,
        anExpirationTimestamp,
        true
      )(deps)();

      expect(E.isLeft(result)).toBe(true);
      expect(result).toEqual(E.left(error));
    });
  });
});
