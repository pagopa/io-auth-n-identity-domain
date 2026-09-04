import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import { LollipopAssertionRefSchema } from "../lollipop-assertion-ref.vo.js";

const digest = (algorithm: "sha256" | "sha384" | "sha512"): string =>
  createHash(algorithm).update("test assertion ref").digest("base64url");

describe("LollipopAssertionRefSchema", () => {
  it.each(["sha256", "sha384", "sha512"] as const)(
    "accepts a valid %s assertion reference",
    (algorithm) => {
      const result = LollipopAssertionRefSchema.safeParse(
        `${algorithm}-${digest(algorithm)}`,
      );

      expect(result.success).toBe(true);
    },
  );

  it.each([
    ["unsupported algorithm", "md5-abcdefghijklmnopqrstuvwxyz"],
    ["missing algorithm prefix", digest("sha256")],
    ["wrong digest length", `sha256-${"a".repeat(42)}`],
    ["invalid Base64url character", `sha256-${"a".repeat(42)}+`],
    ["empty digest", "sha256-"],
    ["non-string value", 42],
  ] as const)("rejects an input with %s", (_scenario, input) => {
    const result = LollipopAssertionRefSchema.safeParse(input);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(
        "Invalid assertion ref format",
      );
    }
  });
});
