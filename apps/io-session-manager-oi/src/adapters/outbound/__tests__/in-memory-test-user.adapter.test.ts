import { FiscalCodeSchema } from "@pagopa/hexagonal-core";
import { describe, expect, it } from "vitest";

import { InMemoryTestUserAdapter } from "../in-memory-test-user.adapter.js";

const aTestFiscalCode = FiscalCodeSchema.parse("ISPXNB32R82Y766D");
const anotherFiscalCode = FiscalCodeSchema.parse("AAAAAA00A00A000A");

describe("InMemoryTestUserAdapter", () => {
  const adapter = new InMemoryTestUserAdapter({
    TEST_LOGIN_FISCAL_CODES_COMPRESSED: new Set([aTestFiscalCode]),
  });

  it("returns true for a configured test user", () => {
    expect(adapter.isTestUser(aTestFiscalCode)).toBe(true);
  });

  it("returns false for any other user", () => {
    expect(adapter.isTestUser(anotherFiscalCode)).toBe(false);
  });
});
