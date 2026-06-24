import { z } from "zod";

/**
 * Lollipop HTTP request method verb.
 */
export const LollipopMethodSchema = z
  .enum(["GET", "POST", "PUT", "PATCH", "DELETE"])
  .describe("Lollipop HTTP request method verb")
  .brand<"HttpMethod">();

export type HttpMethod = z.infer<typeof LollipopMethodSchema>;
