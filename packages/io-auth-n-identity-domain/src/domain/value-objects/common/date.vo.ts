import { z } from "zod";

/**
 * Represents a `Date` in the domain and a Unix timestamp in milliseconds at
 * the serialization boundary.
 */
export const DateToTimestamp = z.codec(z.unknown(), z.date(), {
  // `ZodType#decode` has a different callback signature from `z.codec`.
  // Wrap it so the codec only forwards the value being decoded.
  decode: (value) => z.coerce.date().decode(value),
  encode: (date) => date.getTime(),
});
export type DateToTimestamp = z.infer<typeof DateToTimestamp>;
