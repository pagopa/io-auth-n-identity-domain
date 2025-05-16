import { describe, it, expect } from "vitest";
import * as E from "fp-ts/lib/Either";
import { createInterval, Interval } from "../interval";

describe("createInterval", () => {
  const twentyFourHours = 24 * 60 * 60 * 1000;
  const marchFirst2025MidnightTimestamp = 1740787200000;

  it("should return an interval from midnight to midnight of the next day", () => {
    const date = new Date("2025-03-01T15:30:00.000Z");

    const { from, to } = createInterval(new Date(date));

    // 'from' should be midnight of the same day (UTC)
    expect(from.getUTCHours()).toBe(0);
    expect(from.getUTCMinutes()).toBe(0);
    expect(from.getUTCSeconds()).toBe(0);
    expect(from.getUTCMilliseconds()).toBe(0);

    // 'to' should be midnight of the next day (UTC)
    expect(to.getUTCHours()).toBe(0);
    expect(to.getUTCMinutes()).toBe(0);
    expect(to.getUTCSeconds()).toBe(0);
    expect(to.getUTCMilliseconds()).toBe(0);

    // 'to' should be exactly 24 hours after 'from'
    expect(to.getTime() - from.getTime()).toBe(twentyFourHours);

    expect(from.getTime()).toBe(
      marchFirst2025MidnightTimestamp - twentyFourHours
    );
    expect(to.getTime()).toBe(marchFirst2025MidnightTimestamp);

    expect(from.toISOString()).toBe("2025-02-28T00:00:00.000Z");
    expect(to.toISOString()).toBe("2025-03-01T00:00:00.000Z");
  });

  it("should create contiguous intervals", () => {
    const dateA = new Date("2025-03-01T15:30:00.000Z");
    const dateB = new Date("2025-03-02T02:30:00.000Z");

    const { from: fromA, to: toA } = createInterval(new Date(dateA));
    const { from: fromB, to: toB } = createInterval(new Date(dateB));

    expect(toA.getTime()).toBe(fromB.getTime());

    // 'toB' should be exactly 48 hours after 'fromA'
    expect(toB.getTime() - fromA.getTime()).toBe(2 * twentyFourHours);
  });

  it("should decode correctly an Interval from Dates", () => {
    const date = new Date("2024-06-01T00:00:00.000Z");
    const interval = createInterval(date);
    const validation = Interval.decode({ ...interval });
    expect(E.isRight(validation)).toBe(true);
    expect(validation).toEqual(
      E.right({
        from: new Date("2024-05-31T00:00:00.000Z"),
        to: date
      })
    );
  });

  it("should decode correctly an Interval from timestamps", () => {
    const from = new Date("2024-12-30T00:00:00.000Z").getTime();
    const to = new Date("2024-12-31T00:00:00.000Z").getTime();
    const validation = Interval.decode({
      from: new Date(from),
      to: new Date(to)
    });
    expect(E.isRight(validation)).toBe(true);
    expect(validation).toEqual(
      E.right({
        from: new Date(from),
        to: new Date(to)
      })
    );
  });
});
