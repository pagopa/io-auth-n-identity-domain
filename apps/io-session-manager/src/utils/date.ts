import { addYears, format, isAfter } from "date-fns";

/**
 * Returns a formatted date.
 *
 * ie. convert 1980-13-1 to 1980-13-01
 */
export function formatDate(dateStr: string): string {
  return format(dateStr, "YYYY-MM-DD");
}

/**
 * Returns a comparator of two dates that returns true if
 * the difference in years is at least the provided value.
 */
export const isOlderThan = (years: number) => (dateOfBirth: Date, when: Date) =>
  !isAfter(addYears(dateOfBirth, years), when);
