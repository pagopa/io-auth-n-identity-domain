import * as E from "fp-ts/lib/Either";
import { describe, expect, it } from "vitest";
import { AuthSessionEvent } from "../auth-session-event";

const aTimestamp = Date.now();

const aBaseRejectedLoginEvent = {
  eventType: "rejected_login",
  createdAtDay: "2023-08-15",
  ip: "127.0.0.1",
  requestPayload: "<xml>request</xml>",
  responsePayload: "<xml>response</xml>",
  spidRequestId: "request-id-123",
  fiscalCode: "AAAAAA89S20I111X",
  ts: aTimestamp,
};

describe("AuthSessionEvent decode tests", () => {
  it("should decode a valid Login event", () => {
    const aValidLoginEvent = {
      eventType: "login",
      fiscalCode: "AAAAAA89S20I111X",
      ts: aTimestamp,
      expiredAt: 1748508155,
      loginType: "legacy",
      scenario: "standard",
      idp: "idp.example.com",
    };
    const decodeResult = AuthSessionEvent.decode(aValidLoginEvent);

    expect(decodeResult).toStrictEqual(
      E.of({
        ...aValidLoginEvent,
        expiredAt: new Date(aValidLoginEvent.expiredAt),
        ts: new Date(aValidLoginEvent.ts),
      }),
    );
  });

  it("should fail when a login event lack of required properties", () => {
    const aBadLoginEvent = {
      eventType: "login",
      fiscalCode: "AAAAAA89S20I111X",
      ts: aTimestamp,
      expiredAt: 1748508155,
      loginType: "legacy",
      scenario: "standard",
      // Missing 'idp' property
    };
    const decodeResult = AuthSessionEvent.decode(aBadLoginEvent);

    expect(E.isLeft(decodeResult)).toBe(true);
  });

  it("should decode a valid Logout event", () => {
    const aValidLogoutEvent = {
      eventType: "logout",
      fiscalCode: "AAAAAA89S20I111X",
      ts: aTimestamp,
      scenario: "app",
    };
    const decodeResult = AuthSessionEvent.decode(aValidLogoutEvent);

    expect(decodeResult).toStrictEqual(
      E.of({
        ...aValidLogoutEvent,
        ts: new Date(aValidLogoutEvent.ts),
      }),
    );
  });

  it("should fail when a logout event lack of required properties", () => {
    const aBadLogoutEvent = {
      eventType: "logout",
    };
    const decodeResult = AuthSessionEvent.decode(aBadLogoutEvent);

    expect(E.isLeft(decodeResult)).toBe(true);
  });

  it("should decode a valid RejectedLogin (Age Block) event", () => {
    const aValidRejectedLoginEvent = {
      rejectionCause: "age_block",
      ...aBaseRejectedLoginEvent,
    };
    const decodeResult = AuthSessionEvent.decode(aValidRejectedLoginEvent);

    expect(decodeResult).toStrictEqual(
      E.of({
        ...aValidRejectedLoginEvent,
        ts: new Date(aValidRejectedLoginEvent.ts),
      }),
    );
  });

  it("should decode a valid RejectedLogin (Auth Lock) event", () => {
    const aValidRejectedLoginEvent = {
      rejectionCause: "auth_lock",
      ...aBaseRejectedLoginEvent,
    };
    const decodeResult = AuthSessionEvent.decode(aValidRejectedLoginEvent);

    expect(decodeResult).toStrictEqual(
      E.of({
        ...aValidRejectedLoginEvent,
        ts: new Date(aValidRejectedLoginEvent.ts),
      }),
    );
  });

  it("should decode a valid RejectedLogin (User Mismatch) event", () => {
    const aValidRejectedLoginEvent = {
      rejectionCause: "cf_mismatch",
      currentFiscalCode:
        "438cb21f4edc118a51ae28dc4125f4cf59c29e252f30e4e77746b24c6d39fae6", // sha256 of "BBBBBB89S20I111Y",
      ...aBaseRejectedLoginEvent,
    };

    const decodeResult = AuthSessionEvent.decode(aValidRejectedLoginEvent);

    expect(decodeResult).toStrictEqual(
      E.of({
        ...aValidRejectedLoginEvent,
        ts: new Date(aValidRejectedLoginEvent.ts),
      }),
    );
  });

  it("should fail when a rejected_login event lack of required properties", () => {
    const aBadRejectedLoginEvent = {
      eventType: "rejected_login",
    };
    const decodeResult = AuthSessionEvent.decode(aBadRejectedLoginEvent);

    expect(E.isLeft(decodeResult)).toBe(true);
  });

  it("should fail when an unknown event is given", () => {
    const anUnknownEvent = {
      eventType: "unknown_event",
      fiscalCode: "AAAAAA89S20I111X",
    };
    const decodeResult = AuthSessionEvent.decode(anUnknownEvent);

    expect(E.isLeft(decodeResult)).toBe(true);
  });
});
