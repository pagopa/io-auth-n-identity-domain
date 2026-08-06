import { describe, expect, it } from "vitest";
import { DateToTimestamp } from "../date.vo.js";

describe("DateToTimestamp", () => {
  const timestamp = 1_786_032_000_000;
  const date = new Date(timestamp);

  it("decodes a millisecond timestamp into a Date", () => {
    expect(DateToTimestamp.decode(timestamp)).toStrictEqual(date);
  });

  it("accepts an existing Date", () => {
    expect(DateToTimestamp.decode(date)).toStrictEqual(date);
  });

  it("encodes a Date into a millisecond timestamp", () => {
    expect(DateToTimestamp.encode(date)).toBe(timestamp);
  });

  it("rejects values that cannot be coerced into a Date", () => {
    expect(() => DateToTimestamp.safeParse("not-a-date")).toThrow();
  });
});
