import * as E from "fp-ts/lib/Either";
import { describe, expect, it } from "vitest";
import { AuthSessionEvent } from "../auth-session-event";

const aTimestamp = new Date().getTime();

describe("AuthSessionEvent decode tests", () => {
  it("should decode a valid Login event", () => {
    const aValidLoginEvent = {
      eventType: "LOGIN",
      fiscalCode: "AAAAAA89S20I111X",
      ts: aTimestamp,
      expiredAt: 1748508155,
      loginType: "LEGACY",
      scenario: "STANDARD",
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
      eventType: "LOGIN",
      fiscalCode: "AAAAAA89S20I111X",
      ts: aTimestamp,
      expiredAt: 1748508155,
      loginType: "LEGACY",
      scenario: "STANDARD",
      // Missing 'idp' property
    };
    const decodeResult = AuthSessionEvent.decode(aBadLoginEvent);

    expect(E.isLeft(decodeResult)).toBe(true);
  });

  it("should decode a valid Logout event", () => {
    const aValidLogoutEvent = {
      eventType: "LOGOUT",
      fiscalCode: "AAAAAA89S20I111X",
      ts: aTimestamp,
      scenario: "APP",
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
      eventType: "LOGOUT",
    };
    const decodeResult = AuthSessionEvent.decode(aBadLogoutEvent);

    expect(E.isLeft(decodeResult)).toBe(true);
  });

  it("should fail when an unknown event is given", () => {
    const anUnknownEvent = {
      eventType: "UNKNOWN_EVENT",
      fiscalCode: "AAAAAA89S20I111X",
    };
    const decodeResult = AuthSessionEvent.decode(anUnknownEvent);

    expect(E.isLeft(decodeResult)).toBe(true);
  });
});
