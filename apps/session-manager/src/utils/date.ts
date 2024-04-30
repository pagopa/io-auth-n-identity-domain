import { format } from "date-fns";

/**
 * Returns a formatted date.
 *
 * ie. convert 1980-13-1 to 1980-13-01
 */
export function formatDate(dateStr: string): string {
  return format(dateStr, "YYYY-MM-DD");
}
