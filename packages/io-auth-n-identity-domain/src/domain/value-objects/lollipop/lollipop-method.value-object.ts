import { z } from "zod";

/**
 * Lollipop HTTP request method verb.
 */
export const LollipopMethodSchema = z
  .enum(["GET", "POST", "PUT", "PATCH", "DELETE"])
  .describe("Lollipop HTTP request method verb")
  .brand<"LollipopMethod">();

export type LollipopMethod = z.infer<typeof LollipopMethodSchema>;
