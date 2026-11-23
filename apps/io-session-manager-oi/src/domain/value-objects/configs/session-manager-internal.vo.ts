import { NonEmptyStringSchema } from "@pagopa/hexagonal-core";
import { HttpUrlCodec } from "@pagopa/io-auth-n-identity-domain";
import { z } from "zod";


/**
 * IO Session Manager Internal configuration schema.
 * Consists of the URL, base path, and API key for the IO Session Manager Internal service.
 */
export const IoSmIntConfigSchema = z.object({
  IO_SM_INT_API_URL: HttpUrlCodec, // TODO: rename to IO_SM_INT_API_URL_ORIGIN (since that is what we currently expect)
  IO_SM_INT_API_BASE_PATH: NonEmptyStringSchema,
  IO_SM_INT_API_KEY: NonEmptyStringSchema,
});
