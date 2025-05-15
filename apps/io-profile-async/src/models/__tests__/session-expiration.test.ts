import { beforeEach, describe, it, expect, vi } from "vitest";
import { Container } from "@azure/cosmos";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import * as E from "fp-ts/lib/Either";
import * as t from "io-ts";
import {
  NotificationEvents,
  RetrievedSessionExpiration,
  SessionExpiration,
  SessionExpirationModel
} from "../session-expiration";

const anId = "AAAAAA89S20I111X" as NonEmptyString;
const anExpirationTimestamp = 1746992855578;
const aTtl = 885551;

const aNotificationEvents = {
  EXPIRING_SESSION: false,
  EXPIRED_SESSION: true
} as NotificationEvents;

const aSessionExpiration = {
  id: anId,
  expiredAt: anExpirationTimestamp,
  notificationEvents: aNotificationEvents,
  ttl: aTtl
} as SessionExpiration;

const cosmosMetadata = {
  _rid: "rid",
  _self: "self",
  _etag: "etag",
  _ts: 1693992855
};

const aRetrievedSessionExpiration = {
  ...aSessionExpiration,
  ...cosmosMetadata,
  kind: "IRetrievedSessionExpiration"
} as RetrievedSessionExpiration;

describe("SessionExpiration model decoding", () => {
  it("should decode a SessionExpiration", () => {
    const sessionExpiration = SessionExpiration.decode(aSessionExpiration);

    expect(sessionExpiration).toEqual(
      E.right({
        ...aSessionExpiration
      })
    );
  });

  it("should decode a RetrievedSessionExpiration as a SessionExpiration", () => {
    const sessionExpiration = SessionExpiration.decode(
      aRetrievedSessionExpiration
    );

    // It keeps the data of the original object but it doesn't fail the decoding
    expect(sessionExpiration).toEqual(
      E.right({
        ...aRetrievedSessionExpiration
      })
    );
  });
});

describe("RetrievedSessionExpiration model decoding", () => {
  it("should decode a RetrievedSessionExpiration", () => {
    const retrievedSessionExpiration = RetrievedSessionExpiration.decode(
      aRetrievedSessionExpiration
    );

    expect(retrievedSessionExpiration).toEqual(
      E.right({
        ...aRetrievedSessionExpiration
      })
    );
  });

  it("should fail to decode a SessionExpiration as RetrievedSessionExpiration", () => {
    const invalid = RetrievedSessionExpiration.decode(aSessionExpiration);
    expect(E.isLeft(invalid)).toBe(true);
  });
});

describe("buildAsyncIterable", () => {
  const containerMock: Container = {} as Container;
  const model: SessionExpirationModel = new SessionExpirationModel(
    containerMock
  );

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should call getQueryIterator with correct parameters", async () => {
    const query = "SELECT * FROM c";
    const chunkSize = 10;
    const expectedResult = {} as AsyncIterable<
      ReadonlyArray<t.Validation<RetrievedSessionExpiration>>
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
