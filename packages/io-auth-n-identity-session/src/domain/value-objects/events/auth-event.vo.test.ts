import { FiscalCodeSchema } from "@pagopa/hexagonal-core";
import { describe, expect, it } from "vitest";
import { Sha256HexStringSchema } from "../../../utils/hash.js";
import { AuthEventSchema } from "./auth-event.vo.js";

const fiscalCode = FiscalCodeSchema.parse("AAAAAA00A00A000A");
const fiscalCodeHash = Sha256HexStringSchema.parse(
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
);

describe("AuthEventSchema", () => {
  it("encodes a login event through the top-level discriminator", () => {
    expect(
      AuthEventSchema.encode({
        eventType: "login",
        fiscalCode,
        ts: new Date("2026-08-06T00:00:00.000Z"),
        expiredAt: new Date("2026-08-06T01:00:00.000Z"),
        loginType: "lv",
        scenario: "standard",
        idp: "https://idp.example.com",
      }),
    ).toEqual({
      eventType: "login",
      fiscalCode: "AAAAAA00A00A000A",
      ts: 1_785_974_400_000,
      expiredAt: 1_785_978_000_000,
      loginType: "lv",
      scenario: "standard",
      idp: "https://idp.example.com",
    });
  });

  it("encodes a rejected login event through the nested discriminator", () => {
    expect(
      AuthEventSchema.encode({
        eventType: "rejected_login",
        rejectionCause: "cf_mismatch",
        fiscalCode,
        ts: new Date("2026-08-06T00:00:00.000Z"),
        expiredAt: new Date("2026-08-06T01:00:00.000Z"),
        ip: "192.0.2.1",
        currentFiscalCodeHash: fiscalCodeHash,
      }),
    ).toEqual({
      eventType: "rejected_login",
      rejectionCause: "cf_mismatch",
      fiscalCode: "AAAAAA00A00A000A",
      ts: 1_785_974_400_000,
      expiredAt: 1_785_978_000_000,
      ip: "192.0.2.1",
      currentFiscalCodeHash:
        "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    });
  });

  it("decodes a rejected login event through the nested discriminator", () => {
    expect(
      AuthEventSchema.decode({
        eventType: "rejected_login",
        rejectionCause: "auth_lock",
        fiscalCode: "AAAAAA00A00A000A",
        ts: 1_785_974_400_000,
        expiredAt: 1_785_978_000_000,
        ip: "192.0.2.1",
      }),
    ).toEqual({
      eventType: "rejected_login",
      rejectionCause: "auth_lock",
      fiscalCode: "AAAAAA00A00A000A",
      ts: new Date("2026-08-06T00:00:00.000Z"),
      expiredAt: new Date("2026-08-06T01:00:00.000Z"),
      ip: "192.0.2.1",
    });
  });
});
