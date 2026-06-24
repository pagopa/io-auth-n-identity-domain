import { z } from "zod";

/**
 * A well-formed URL that uses the HTTPS scheme.
 */
export const LollipopOriginalUrlSchema = z
  .url({
    protocol: /^https$/,
  })
  .describe("A well-formed URL that uses the HTTPS scheme")
  .brand<"LollipopOriginalUrl">();

export type LollipopOriginalUrl = z.infer<typeof LollipopOriginalUrlSchema>;
