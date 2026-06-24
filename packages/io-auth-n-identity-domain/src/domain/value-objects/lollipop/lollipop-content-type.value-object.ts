import { z } from "zod";

/**
 * Content-Type header value for Lollipop requests.
 * Only `application/json` and `application/octet-stream` are supported.
 */
export const LollipopContentTypeSchema = z
  .enum(["application/json", "application/octet-stream"])
  .describe("Content-Type header value for Lollipop requests")
  .brand<"LollipopContentType">();

export type LollipopContentType = z.infer<typeof LollipopContentTypeSchema>;
