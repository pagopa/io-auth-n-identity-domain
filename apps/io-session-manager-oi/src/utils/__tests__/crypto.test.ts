import { describe, expect, it } from "vitest";
import { Hash } from "../crypto.js";

describe("Hash.sha256", () => {
  it("returns the SHA-256 digest as a hexadecimal string", () => {
    expect(Hash.sha256("hello world")).toBe(
      "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9",
    );
  });

  it("returns the SHA-256 digest for an empty string", () => {
    expect(Hash.sha256("")).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
  });
});