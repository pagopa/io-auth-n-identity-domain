import { z } from "zod";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export declare const BrandLollipopOriginalUrl: unique symbol;
/**
 * HTTPS URL of the original request bound by a Lollipop signature.
 */
export const LollipopOriginalUrlSchema = z
  .string()
  .regex(/^https:\/\//, { message: "Invalid Lollipop original url format" })
  .brand<typeof BrandLollipopOriginalUrl>();

export type LollipopOriginalUrl = z.infer<typeof LollipopOriginalUrlSchema>;
