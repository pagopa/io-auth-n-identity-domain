import { describe, test, expect } from "vitest";
import { formatDate } from "../date";

describe("DateUtils#formatDate", () => {
  test("should pad an invalid format", () => {
    const parsed = formatDate("1980-10-1");
    expect(parsed).toEqual("1980-10-01");
  });
  test("should pad an invalid format", () => {
    const parsed = formatDate("1980-2-3");
    expect(parsed).toEqual("1980-02-03");
  });
});
