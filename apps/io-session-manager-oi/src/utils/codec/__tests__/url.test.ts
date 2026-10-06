import { describe, expect, it } from "vitest";

import { HttpUrlCodec } from "../url.js";

describe("UrlCodec", () => {
  it("decodes a string into a URL", () => {
    const decoded = HttpUrlCodec.decode("https://example.com/path?query=value");

    expect(decoded).toEqual(new URL("https://example.com/path?query=value"));
  });

  it("encodes a URL into a string", () => {
    const url = new URL("https://example.com/path?query=value");

    expect(HttpUrlCodec.encode(url)).toBe(
      "https://example.com/path?query=value",
    );
  });

  it("rejects invalid URL strings", () => {
    expect(HttpUrlCodec.safeDecode("not-a-url").success).toBe(false);
  });
});
