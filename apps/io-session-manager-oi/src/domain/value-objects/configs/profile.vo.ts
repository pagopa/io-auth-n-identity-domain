import { NonEmptyStringSchema } from "@pagopa/hexagonal-core";
import { z } from "zod";

/**
 * IO Profile configuration schema.
 * Consists of the URL, base path, and API key for the IO Profile service.
 */
export const IoProfileConfigSchema = z.object({
  IO_PROFILE_API_URL: z.url(),
  IO_PROFILE_API_BASE_PATH: NonEmptyStringSchema,
  IO_PROFILE_API_KEY: NonEmptyStringSchema,
});
