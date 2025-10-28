import * as E from "fp-ts/lib/Either";
import { describe, expect, it } from "vitest";
import { LogoutEvent } from "../logout-event";

const aTimestamp = Date.now();

describe("LogoutEvent decode tests", () => {
  it("should decode a valid Logout event", () => {
    const aValidLogoutEvent = {
      eventType: "logout",
      fiscalCode: "AAAAAA89S20I111X",
      ts: aTimestamp,
      scenario: "app",
    };
    const decodeResult = LogoutEvent.decode(aValidLogoutEvent);

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
    const decodeResult = LogoutEvent.decode(aBadLogoutEvent);

    expect(E.isLeft(decodeResult)).toBe(true);
  });
});
