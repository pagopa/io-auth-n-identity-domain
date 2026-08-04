import { NonEmptyStringSchema } from "@pagopa/hexagonal-core";
import { z } from "zod";

/**
 * IO Session Manager Internal configuration schema.
 * Consists of the URL, base path, and API key for the IO Session Manager Internal service.
 */
export const IoSmIntConfigSchema = z.object({
  IO_SM_INT_API_URL: z.url(),
  IO_SM_INT_API_BASE_PATH: NonEmptyStringSchema,
  IO_SM_INT_API_KEY: NonEmptyStringSchema,
});

export type IoSmIntConfig = z.infer<typeof IoSmIntConfigSchema>;
