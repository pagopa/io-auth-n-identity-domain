import { describe, expect, it } from "vitest";

import { LollipopContentDigestSchema } from "../lollipop-content-digest.value-object.js";
import { computeContentDigest } from "../../../entities/__tests__/lollipop-required-headers.entity.test.js";

describe("LollipopContentDigestSchema", () => {
  it.each(["sha-256", "sha-384", "sha-512"] as const)(
    "accepts a valid %s content-digest",
    (algorithm) => {
      expect(
        LollipopContentDigestSchema.safeParse(
          computeContentDigest(algorithm, "hello"),
        ).success,
      ).toBe(true);
    },
  );

  it.each([
    ["rejects empty string", ""],
    ["rejects unknown algorithm md5", "md5=:abc:"],
    [
      "rejects sha-256 digest with wrong length (43)",
      `sha-256=:${"a".repeat(43)}:`,
    ],
    [
      "rejects sha-256 digest with wrong length (45)",
      `sha-256=:${"a".repeat(45)}:`,
    ],
    [
      "rejects sha-384 digest with wrong length (63)",
      `sha-384=:${"a".repeat(63)}:`,
    ],
    [
      "rejects sha-384 digest with wrong length (65)",
      `sha-384=:${"a".repeat(65)}:`,
    ],
    [
      "rejects sha-512 digest with wrong length (87)",
      `sha-512=:${"a".repeat(87)}:`,
    ],
    [
      "rejects sha-512 digest with wrong length (89)",
      `sha-512=:${"a".repeat(89)}:`,
    ],
    ["rejects missing trailing colon", `sha-256=:${"a".repeat(44)}`],
    ["rejects missing leading colon after =", `sha-256=${"a".repeat(44)}:`],
  ])("%s", (_scenario, input) => {
    expect(LollipopContentDigestSchema.safeParse(input).success).toBe(false);
  });
});
