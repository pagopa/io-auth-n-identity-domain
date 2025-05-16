import { Container } from "@azure/cosmos";
import { FiscalCode } from "@pagopa/ts-commons/lib/strings";
import * as E from "fp-ts/lib/Either";
import * as t from "io-ts";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  NotificationEvents,
  RetrievedSessionNotifications,
  SessionNotifications,
  SessionNotificationsModel
} from "../session-notifications";

const anId = "AAAAAA89S20I111X" as FiscalCode;
const anExpirationTimestamp = 1746992855578;
const aTtl = 885551;

const aNotificationEvents = {
  EXPIRING_SESSION: false,
  EXPIRED_SESSION: true
} as NotificationEvents;

const aSessionNotifications = {
  id: anId,
  expiredAt: anExpirationTimestamp,
  notificationEvents: aNotificationEvents,
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

describe("SessionNotifications model decoding", () => {
  it("should decode a SessionNotifications", () => {
    const sessionNotifications = SessionNotifications.decode(
      aSessionNotifications
    );

    expect(sessionNotifications).toEqual(
      E.right({
        ...aSessionNotifications
      })
    );
  });

  it("should decode a RetrievedSessionNotifications as a SessionNotifications", () => {
    const sessionNotifications = SessionNotifications.decode(
      aRetrievedSessionNotifications
    );

    // It keeps the data of the original object but it doesn't fail the decoding
    expect(sessionNotifications).toEqual(
      E.right({
        ...aRetrievedSessionNotifications
      })
    );
  });
});

describe("RetrievedSessionNotifications model decoding", () => {
  it("should decode a RetrievedSessionNotifications", () => {
    const retrievedSessionNotifications = RetrievedSessionNotifications.decode(
      aRetrievedSessionNotifications
    );

    expect(retrievedSessionNotifications).toEqual(
      E.right({
        ...aRetrievedSessionNotifications
      })
    );
  });

  it("should fail to decode a SessionNotifications as RetrievedSessionNotifications", () => {
    const invalid = RetrievedSessionNotifications.decode(aSessionNotifications);
    expect(E.isLeft(invalid)).toBe(true);
  });
});

describe("buildAsyncIterable", () => {
  const containerMock: Container = {} as Container;
  const model: SessionNotificationsModel = new SessionNotificationsModel(
    containerMock
  );

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should call getQueryIterator with correct parameters", async () => {
    const query = "SELECT * FROM c";
    const chunkSize = 10;
    const expectedResult = {} as AsyncIterable<
      ReadonlyArray<t.Validation<RetrievedSessionNotifications>>
    >;

    const getQueryIteratorSpy = vi
      .spyOn(model, "getQueryIterator")
      .mockReturnValue(expectedResult);

    const result = model.buildAsyncIterable(query, chunkSize);

    expect(getQueryIteratorSpy).toHaveBeenCalledWith(query, {
      maxItemCount: chunkSize
    });
    expect(result).toBe(expectedResult);
  });
});
