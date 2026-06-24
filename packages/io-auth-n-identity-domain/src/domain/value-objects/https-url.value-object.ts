import { z } from "zod";

/**
 * A well-formed URL that uses the HTTPS scheme.
 */
export const HttpsUrlSchema = z
  .url({
    protocol: /^https$/,
  })
  .describe("A well-formed URL that uses the HTTPS scheme")
  .brand<"HttpsUrl">();

export type HttpsUrl = z.infer<typeof HttpsUrlSchema>;
