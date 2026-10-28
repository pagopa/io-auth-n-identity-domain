import { FiscalCodeSchema, NonEmptyStringSchema } from "@pagopa/hexagonal-core";
import { describe, expect, it } from "vitest";

import { InMemoryTestUserAdapter } from "../in-memory-test-user.adapter.js";

const aTestFiscalCode = FiscalCodeSchema.parse("ISPXNB32R82Y766D");
const anotherFiscalCode = FiscalCodeSchema.parse("AAAAAA00A00A000A");
const aPassword = NonEmptyStringSchema.parse("a-password");
const aWrongPassword = NonEmptyStringSchema.parse("wrong-password");

describe("InMemoryTestUserAdapter", () => {
  const adapter = new InMemoryTestUserAdapter({
    TEST_LOGIN_FISCAL_CODES_COMPRESSED: new Set([aTestFiscalCode]),
    TEST_LOGIN_PASSWORD: aPassword,
  });

  it("returns true for a configured test user", () => {
    expect(adapter.isTestUser(aTestFiscalCode)).toBe(true);
  });

  it("returns false for any other user", () => {
    expect(adapter.isTestUser(anotherFiscalCode)).toBe(false);
  });

  it("accepts a test user with the correct password", () => {
    expect(adapter.isTestCredentials(aTestFiscalCode, aPassword)).toBe(true);
  });

  it("rejects a test user with a wrong password", () => {
    expect(adapter.isTestCredentials(aTestFiscalCode, aWrongPassword)).toBe(
      false,
    );
  });

  it("rejects a non-test user even with the correct password", () => {
    expect(adapter.isTestCredentials(anotherFiscalCode, aPassword)).toBe(false);
  });
});
