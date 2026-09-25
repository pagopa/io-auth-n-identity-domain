import { afterEach, describe, expect, it, vi } from "vitest";

import { getActiveSessionExpiration } from "../active-session.entity.js";

const aStartingDate = new Date("2026-01-15T12:00:00.000Z");

// -----------------------------------------------------
// Tests
// -----------------------------------------------------

describe("getActiveSessionExpiration", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns an expiration date 30 days after the starting date for LEGACY login", () => {
    expect(getActiveSessionExpiration("LEGACY", aStartingDate)).toEqual(
      new Date("2026-02-14T12:00:00.000Z"),
    );
  });

  it("returns an expiration date 365 days after the starting date for LV login", () => {
    expect(getActiveSessionExpiration("LV", aStartingDate)).toEqual(
      new Date("2027-01-15T12:00:00.000Z"),
    );
  });

  it("uses the current date when the starting date is omitted", () => {
    const now = new Date("2026-01-15T12:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);

    expect(getActiveSessionExpiration("LEGACY")).toEqual(
      new Date("2026-02-14T12:00:00.000Z"),
    );
  });
});
