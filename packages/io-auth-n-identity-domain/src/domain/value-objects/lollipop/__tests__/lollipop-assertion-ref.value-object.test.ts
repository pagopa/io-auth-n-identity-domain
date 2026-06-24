import { describe, expect, it } from "vitest";

import {
  AssertionRefSha256Schema,
  AssertionRefSha384Schema,
  AssertionRefSha512Schema,
  LollipopAssertionRefSchema,
} from "../lollipop-assertion-ref.value-object.js";
import { anAssertionRef } from "../../../__mocks__/lollipop.mock.js";

describe("AssertionRefSha256Schema", () => {
  it.each(["sha256-abc", "sha256-ABC123", "sha256-Az09-_="])(
    'accepts "%s"',
    (value) => {
      expect(AssertionRefSha256Schema.safeParse(value).success).toBe(true);
    },
  );

  it.each`
    scenario                           | input
    ${"rejects empty string"}          | ${""}
    ${"rejects wrong prefix sha384"}   | ${"sha384-abc"}
    ${"rejects no prefix"}             | ${"abc123"}
    ${"rejects invalid chars"}         | ${"sha256-!!!"}
    ${"rejects sha256 with 45+ chars"} | ${`sha256-${"a".repeat(45)}`}
  `("$scenario", ({ input }) => {
    expect(AssertionRefSha256Schema.safeParse(input).success).toBe(false);
  });
});

describe("AssertionRefSha384Schema", () => {
  it.each(["sha384-abc", "sha384-ABC123", "sha384-Az09-_="])(
    'accepts "%s"',
    (value) => {
      expect(AssertionRefSha384Schema.safeParse(value).success).toBe(true);
    },
  );

  it.each`
    scenario                           | input
    ${"rejects empty string"}          | ${""}
    ${"rejects wrong prefix sha256"}   | ${"sha256-abc"}
    ${"rejects invalid chars"}         | ${"sha384-!!!"}
    ${"rejects sha384 with 65+ chars"} | ${`sha384-${"a".repeat(65)}`}
  `("$scenario", ({ input }) => {
    expect(AssertionRefSha384Schema.safeParse(input).success).toBe(false);
  });
});

describe("AssertionRefSha512Schema", () => {
  it.each(["sha512-abc", "sha512-ABC123", "sha512-Az09-_="])(
    'accepts "%s"',
    (value) => {
      expect(AssertionRefSha512Schema.safeParse(value).success).toBe(true);
    },
  );

  it.each`
    scenario                           | input
    ${"rejects empty string"}          | ${""}
    ${"rejects wrong prefix sha256"}   | ${"sha256-abc"}
    ${"rejects invalid chars"}         | ${"sha512-!!!"}
    ${"rejects sha512 with 89+ chars"} | ${`sha512-${"a".repeat(89)}`}
  `("$scenario", ({ input }) => {
    expect(AssertionRefSha512Schema.safeParse(input).success).toBe(false);
  });
});

describe("LollipopAssertionRefSchema", () => {
  it.each(["sha256-abc", "sha384-abc", "sha512-abc"])(
    'accepts "%s"',
    (value) => {
      expect(LollipopAssertionRefSchema.safeParse(value).success).toBe(true);
    },
  );

  it("accepts a valid sha256 assertion_ref", () => {
    const validSha256Ref = anAssertionRef;
    expect(LollipopAssertionRefSchema.safeParse(validSha256Ref).success).toBe(
      true,
    );
  });

  it.each`
    scenario                       | input
    ${"rejects empty string"}      | ${""}
    ${"rejects unknown algorithm"} | ${"sha1-abc"}
    ${"rejects no prefix"}         | ${"abc123"}
  `("$scenario", ({ input }) => {
    expect(LollipopAssertionRefSchema.safeParse(input).success).toBe(false);
  });
});

describe("AssertionRef max-length boundary", () => {
  it("accepts sha256 ref at exactly 44 chars", () => {
    expect(
      AssertionRefSha256Schema.safeParse(`sha256-${"a".repeat(44)}`).success,
    ).toBe(true);
  });

  it("accepts sha384 ref at exactly 64 chars", () => {
    expect(
      AssertionRefSha384Schema.safeParse(`sha384-${"a".repeat(64)}`).success,
    ).toBe(true);
  });

  it("accepts sha512 ref at exactly 88 chars", () => {
    expect(
      AssertionRefSha512Schema.safeParse(`sha512-${"a".repeat(88)}`).success,
    ).toBe(true);
  });

  it("rejects sha256 ref at 45 chars", () => {
    expect(
      AssertionRefSha256Schema.safeParse(`sha256-${"a".repeat(45)}`).success,
    ).toBe(false);
  });
});
