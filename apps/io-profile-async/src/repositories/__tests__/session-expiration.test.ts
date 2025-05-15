import { describe, it, expect, vi, beforeEach, Mock } from "vitest";
import * as E from "fp-ts/lib/Either";
import * as TE from "fp-ts/TaskEither";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { CosmosErrors } from "@pagopa/io-functions-commons/dist/src/utils/cosmosdb_model";
import {
  Dependencies,
  SessionExpirationRepository
} from "../session-expiration";
import {
  NotificationEvents,
  SESSION_EXPIRATION_ROW_PK_FIELD,
  SessionExpiration,
  SessionExpirationModel
} from "../../models/session-expiration";
import { Interval } from "../../types/interval";

const anId = "AAAAAA89S20I111X" as NonEmptyString;
const anExpirationDate = 1746992855578;
const aTtl = 885551;

const aNotificationEvents = {
  EXPIRING_SESSION: false,
  EXPIRED_SESSION: true
} as NotificationEvents;

const aSessionExpiration = {
  id: anId,
  expirationDate: anExpirationDate,
  notificationEvents: aNotificationEvents,
  ttl: aTtl
} as SessionExpiration;

const mockSessionExpirationModel = ({
  buildAsyncIterable: vi.fn(),
  patch: vi.fn()
} as unknown) as SessionExpirationModel;

const deps = {
  sessionExpirationModel: mockSessionExpirationModel
} as Dependencies;

describe("SessionExpirationRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("findByExpirationDateAsyncIterable", () => {
    it("should call buildAsyncIterable with correct query and parameters", async () => {
      const interval: Interval = {
        from: new Date(2024, 0, 1),
        to: new Date(2024, 0, 2)
      };

      SessionExpirationRepository.findByExpirationDateAsyncIterable(interval)(
        deps
      );

      expect(
        mockSessionExpirationModel.buildAsyncIterable
      ).toHaveBeenCalledWith(
        {
          parameters: [
            { name: "@from", value: interval.from.getTime() },
            { name: "@to", value: interval.to.getTime() }
          ],
          query:
            `SELECT * FROM c WHERE (c.${SESSION_EXPIRATION_ROW_PK_FIELD} BETWEEN @from AND @to) AND ` +
            "(c.notificationEvents.EXPIRED_SESSION = false OR NOT IS_DEFINED(c.notificationEvents.EXPIRED_SESSION))"
        },
        100
      );
    });
  });

  describe("updateNotificationEvents", () => {
    it("should call patch with correct arguments", async () => {
      (mockSessionExpirationModel.patch as Mock).mockReturnValueOnce(
        TE.right(aSessionExpiration)
      );

      const result = await SessionExpirationRepository.updateNotificationEvents(
        anId,
        anExpirationDate,
        aNotificationEvents
      )(deps)();

      expect(mockSessionExpirationModel.patch).toHaveBeenCalledWith(
        [anId, anExpirationDate],
        { notificationEvents: aNotificationEvents }
      );
      expect(E.isRight(result)).toBe(true);
      expect(result).toEqual(E.right(aSessionExpiration));
    });

    it("should return left on error", async () => {
      const error: CosmosErrors = {
        kind: "COSMOS_ERROR_RESPONSE",
        error: new Error("fail")
      };
      (mockSessionExpirationModel.patch as Mock).mockReturnValueOnce(
        TE.left(error)
      );

      const result = await SessionExpirationRepository.updateNotificationEvents(
        anId,
        anExpirationDate,
        aNotificationEvents
      )(deps)();

      expect(E.isLeft(result)).toBe(true);
      expect(result).toEqual(E.left(error));
    });
  });

  describe("updateNotificationEventsWithRetry", () => {
    it("should resolve to updated document if patch succeeds first try", async () => {
      (mockSessionExpirationModel.patch as Mock).mockReturnValueOnce(
        TE.right(aSessionExpiration)
      );

      const result = await SessionExpirationRepository.updateNotificationEventsWithRetry(
        anId,
        anExpirationDate,
        aNotificationEvents
      )(deps)();

      expect(E.isRight(result)).toBe(true);
      expect(result).toEqual(E.right(aSessionExpiration));
      expect(mockSessionExpirationModel.patch).toHaveBeenCalledTimes(1);
    });

    it("should retry on failure and eventually succeed", async () => {
      const error: CosmosErrors = {
        kind: "COSMOS_ERROR_RESPONSE",
        error: new Error("fail")
      };
      (mockSessionExpirationModel.patch as Mock)
        .mockReturnValueOnce(TE.left(error))
        .mockReturnValueOnce(TE.right(aSessionExpiration));

      const result = await SessionExpirationRepository.updateNotificationEventsWithRetry(
        anId,
        anExpirationDate,
        aNotificationEvents
      )(deps)();

      expect(E.isRight(result)).toBe(true);
      expect(result).toEqual(E.right(aSessionExpiration));
      expect(mockSessionExpirationModel.patch).toHaveBeenCalledTimes(2);
    });

    it("should return left if all retries fail", async () => {
      const error: CosmosErrors = {
        kind: "COSMOS_ERROR_RESPONSE",
        error: new Error("fail")
      };
      (mockSessionExpirationModel.patch as Mock).mockReturnValue(
        TE.left(error)
      );

      const result = await SessionExpirationRepository.updateNotificationEventsWithRetry(
        anId,
        anExpirationDate,
        aNotificationEvents
      )(deps)();

      expect(E.isLeft(result)).toBe(true);
      expect(result).toEqual(E.left(error));
      expect(mockSessionExpirationModel.patch).toHaveBeenCalledTimes(5);
    });
  });
});
