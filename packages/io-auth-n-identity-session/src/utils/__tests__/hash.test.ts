import { describe, expect, it } from "vitest";

import { Sha256HexStringSchema, toSha256 } from "../hash.js";

const hash = "abcdef0123456789".repeat(4);

describe("Sha256HexStringSchema", () => {
  it.each([hash, hash.toUpperCase(), "aBcDeF0123456789".repeat(4)])(
    "normalizes valid hexadecimal hash %s to lowercase",
    (input) => {
      expect(Sha256HexStringSchema.parse(input)).toBe(hash);
      expect(Sha256HexStringSchema.safeParse(input)).toEqual({
        success: true,
        data: hash,
      });
    },
  );

  it.each(["", "a".repeat(63), "a".repeat(65), "g".repeat(64), null, 123])(
    "rejects invalid hash %j",
    (input) => {
      expect(Sha256HexStringSchema.safeParse(input).success).toBe(false);
    },
  );
});

describe("toSha256", () => {
  it("returns the known lowercase SHA-256 digest", () => {
    expect(toSha256("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });
});
