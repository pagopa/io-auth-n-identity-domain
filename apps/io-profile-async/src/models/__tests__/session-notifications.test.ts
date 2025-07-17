/* eslint-disable functional/immutable-data */
import { Container, ErrorResponse, FeedResponse } from "@azure/cosmos";
import { FiscalCode, NonEmptyString } from "@pagopa/ts-commons/lib/strings";
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
  id: (anId as unknown) as NonEmptyString,
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
  const getAsyncIteratorMock = vi.fn();

  const containerMock: Container = ({
    items: {
      query: vi.fn(() => ({
        getAsyncIterator: getAsyncIteratorMock
      }))
    }
  } as unknown) as Container;

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
      ReadonlyArray<t.Validation<FeedResponse<unknown>>>
    >;

    getAsyncIteratorMock.mockReturnValueOnce(expectedResult);

    const result = model.buildAsyncIterable(query, chunkSize);

    expect(containerMock.items.query).toHaveBeenCalledWith(query, {
      maxItemCount: chunkSize
    });

    expect(getAsyncIteratorMock).toHaveBeenCalled();

    expect(result).toBe(expectedResult);
  });
});
describe("delete", () => {
  const deleteMock = vi.fn().mockResolvedValue({});

  const containerMock: Container = ({
    item: vi.fn(() => ({
      delete: deleteMock
    }))
  } as unknown) as Container;

  const model: SessionNotificationsModel = new SessionNotificationsModel(
    containerMock
  );

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should call item.delete with correct parameters", async () => {
    const result = await model.delete([anId, anExpirationTimestamp])();

    expect(containerMock.item).toHaveBeenCalledWith(
      anId,
      anExpirationTimestamp
    );
    expect(deleteMock).toHaveBeenCalled();
    expect(result).toEqual(E.right(undefined));
  });

  it("should propagate the error when item.delete fails", async () => {
    const error = new Error("Delete failed");
    deleteMock.mockRejectedValueOnce(error);

    const result = await model.delete([anId, anExpirationTimestamp])();

    expect(containerMock.item).toHaveBeenCalledWith(
      anId,
      anExpirationTimestamp
    );
    expect(deleteMock).toHaveBeenCalled();
    expect(result).toEqual(E.left({ error, kind: "COSMOS_ERROR_RESPONSE" }));
  });

  it("should not fail on 404 results", async () => {
    const aCosmosErrorResponse = new ErrorResponse("Document not found");
    aCosmosErrorResponse.code = 404;

    deleteMock.mockRejectedValueOnce(aCosmosErrorResponse);

    const result = await model.delete([anId, anExpirationTimestamp])();

    expect(containerMock.item).toHaveBeenCalledWith(
      anId,
      anExpirationTimestamp
    );
    expect(deleteMock).toHaveBeenCalled();
    expect(result).toEqual(E.right(undefined));
  });
});
