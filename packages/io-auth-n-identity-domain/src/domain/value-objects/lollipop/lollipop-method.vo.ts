import { z } from "zod";

/**
 * HTTP method of the original request bound by a Lollipop signature.
 */
export const LollipopMethodSchema = z.enum([
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
]);
export type LollipopMethod = z.infer<typeof LollipopMethodSchema>;
