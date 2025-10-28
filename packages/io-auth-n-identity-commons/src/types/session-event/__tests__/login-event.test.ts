import * as E from "fp-ts/lib/Either";
import { describe, expect, it } from "vitest";
import { LoginEvent } from "../login-event";

const aTimestamp = Date.now();

describe("LoginEvent decode tests", () => {
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
    const decodeResult = LoginEvent.decode(aValidLoginEvent);

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
    const decodeResult = LoginEvent.decode(aBadLoginEvent);

    expect(E.isLeft(decodeResult)).toBe(true);
  });
});
