import { z } from "zod";

export enum LollipopMethodEnum {
  "GET" = "GET",
  "POST" = "POST",
  "PUT" = "PUT",
  "PATCH" = "PATCH",
  "DELETE" = "DELETE",
}
/**
 * HTTP method of the original request bound by a Lollipop signature.
 */
export const LollipopMethodSchema = z.enum(LollipopMethodEnum);
export type LollipopMethod = z.infer<typeof LollipopMethodSchema>;
