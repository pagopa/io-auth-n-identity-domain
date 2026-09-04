import { z } from "zod";

/**
 * Represents a `Date` in the domain and a Unix timestamp in milliseconds at
 * the serialization boundary.
 */
export const TimestampMillisToDate = z.codec(z.int().min(0), z.date(), {
  decode: (millis) => new Date(millis),
  encode: (date) => date.getTime(),
});
export type TimestampMillisToDate = z.infer<typeof TimestampMillisToDate>;
