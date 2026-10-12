import { describe, expect, it } from "vitest";
import { TimestampMillisToDate } from "../date.vo.js";

describe("TimestampMillisToDate", () => {
  const timestamp = 1_786_032_000_000;
  const date = new Date(timestamp);

  it("decodes a millisecond timestamp into a Date", () => {
    expect(TimestampMillisToDate.decode(timestamp)).toStrictEqual(date);
  });

  it("rejects a Date as input", () => {
    expect(TimestampMillisToDate.safeParse(date).success).toBe(false);
  });

  it("encodes a Date into a millisecond timestamp", () => {
    expect(TimestampMillisToDate.encode(date)).toBe(timestamp);
  });

  it("rejects values that are not non-negative integer timestamps", () => {
    expect(TimestampMillisToDate.safeParse("not-a-date").success).toBe(false);
    expect(TimestampMillisToDate.safeParse(-1).success).toBe(false);
    expect(TimestampMillisToDate.safeParse(1.5).success).toBe(false);
  });

  it("rejects timestamps that produce an invalid Date", () => {
    expect(
      TimestampMillisToDate.safeParse(Number.MAX_SAFE_INTEGER).success,
    ).toBe(false);
  });
});
