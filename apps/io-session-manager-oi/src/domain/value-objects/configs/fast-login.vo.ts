import { NonEmptyStringSchema } from "@pagopa/hexagonal-core";
import { z } from "zod";

/*
 * IO Fast Login configuration schema.
 * Consists of the URL, base path, and API key for the IO Fast Login service.
 */
export const IoFastLoginConfigSchema = z.object({
  IO_FAST_LOGIN_API_URL: z.url(),
  IO_FAST_LOGIN_API_BASE_PATH: NonEmptyStringSchema,
  IO_FAST_LOGIN_API_KEY: NonEmptyStringSchema,
});
