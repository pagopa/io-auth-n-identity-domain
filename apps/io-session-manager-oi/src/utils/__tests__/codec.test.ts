import { describe, expect, it } from "vitest";
import { Base64 } from "../codec.js";

const decode = (value: string): string =>
  Buffer.from(value, "base64").toString("utf8");

describe("Base64.encode", () => {
  it.each([
    ["a string", "a string"],
    [42, "42"],
    [true, "true"],
    [null, "null"],
    [undefined, "undefined"],
    [123n, "123"],
  ])("encodes primitive %p", (value, expected) => {
    expect(decode(Base64.encode(value))).toBe(expected);
  });

  it("encodes binary values without serializing them", () => {
    const value = Buffer.from([0, 1, 255]);

    expect(Base64.encode(value)).toBe(value.toString("base64"));
  });

  it("JSON serializes objects", () => {
    const value = { enabled: true, id: 42, tags: ["session"] };

    expect(decode(Base64.encode(value))).toBe(JSON.stringify(value));
  });

  it("serializes bigint properties as strings", () => {
    expect(decode(Base64.encode({ id: 123n }))).toBe('{"id":"123"}');
  });
});
