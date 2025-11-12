import * as E from "fp-ts/lib/Either";
import { describe, expect, it } from "vitest";
import { RejectedLoginEvent } from "../rejected-login-event";

const aTimestamp = Date.now();

const aBaseRejectedLoginEvent = {
  eventType: "rejected_login",
  createdAtDay: "2023-08-15",
  ip: "127.0.0.1",
  loginId: "request-id-123",
  fiscalCode: "AAAAAA89S20I111X",
  ts: aTimestamp,
};

describe("RejectedLoginEvent decode tests", () => {
  it("should decode a valid RejectedLogin (Age Block) event", () => {
    const aValidRejectedLoginEvent = {
      rejectionCause: "age_block",
      minimumAge: 14,
      dateOfBirth: "2009-08-15",
      ...aBaseRejectedLoginEvent,
    };
    const decodeResult = RejectedLoginEvent.decode(aValidRejectedLoginEvent);

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
    const decodeResult = RejectedLoginEvent.decode(aValidRejectedLoginEvent);

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

    const decodeResult = RejectedLoginEvent.decode(aValidRejectedLoginEvent);

    expect(decodeResult).toStrictEqual(
      E.of({
        ...aValidRejectedLoginEvent,
        ts: new Date(aValidRejectedLoginEvent.ts),
      }),
    );
  });

  it("should decode a valid RejectedLogin (Ongoing User Deletion) event", () => {
    const aValidRejectedLoginEvent = {
      rejectionCause: "ongoing_user_deletion",
      ...aBaseRejectedLoginEvent,
    };
    const decodeResult = RejectedLoginEvent.decode(aValidRejectedLoginEvent);

    expect(decodeResult).toStrictEqual(
      E.of({
        ...aValidRejectedLoginEvent,
        ts: new Date(aValidRejectedLoginEvent.ts),
      }),
    );
  });

  it("should decode a valid RejectedLogin when the loginId is missing", () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { loginId, ...withoutLoginId } = aBaseRejectedLoginEvent;

    const aValidRejectedLoginEvent = {
      ...withoutLoginId,
      rejectionCause: "age_block",
      minimumAge: 14,
      dateOfBirth: "2009-08-15",
    };
    const decodeResult = RejectedLoginEvent.decode(aValidRejectedLoginEvent);

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
    const decodeResult = RejectedLoginEvent.decode(aBadRejectedLoginEvent);

    expect(E.isLeft(decodeResult)).toBe(true);
  });
});
