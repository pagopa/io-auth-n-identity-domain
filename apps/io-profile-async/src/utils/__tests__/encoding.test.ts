import { describe, it, expect } from "vitest";
import { base64EncodeObject } from "../encoding";

describe("base64EncodeObject", () => {
  it("should encode a simple object to base64", () => {
    const obj = { foo: "bar" };
    const encoded = base64EncodeObject(obj);
    const decoded = JSON.parse(Buffer.from(encoded, "base64").toString());
    expect(decoded).toEqual(obj);
  });

  it("should encode an array to base64", () => {
    const arr = [1, 2, 3];
    const encoded = base64EncodeObject(arr);
    const decoded = JSON.parse(Buffer.from(encoded, "base64").toString());
    expect(decoded).toEqual(arr);
  });

  it("should encode a string to base64", () => {
    const str = "hello";
    const encoded = base64EncodeObject(str);
    const decoded = JSON.parse(Buffer.from(encoded, "base64").toString());
    expect(decoded).toEqual(str);
  });

  it("should encode a number to base64", () => {
    const num = 42;
    const encoded = base64EncodeObject(num);
    const decoded = JSON.parse(Buffer.from(encoded, "base64").toString());
    expect(decoded).toEqual(num);
  });

  it("should encode null to base64", () => {
    const encoded = base64EncodeObject(null);
    const decoded = JSON.parse(Buffer.from(encoded, "base64").toString());
    expect(decoded).toBeNull();
  });

  it("should throw when encoding undefined to base64", () => {
    // JSON.stringify(undefined) returns undefined, Buffer.from(undefined) throws
    // So we expect an error here
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(() => base64EncodeObject(undefined as any)).toThrow();
  });
});
