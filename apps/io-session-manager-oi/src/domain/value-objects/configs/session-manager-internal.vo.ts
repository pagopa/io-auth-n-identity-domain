import { NonEmptyStringSchema } from "@pagopa/hexagonal-core";
import { z } from "zod";
import { HttpUrlCodec } from "../../../utils/codec/url.js";

/**
 * IO Session Manager Internal configuration schema.
 * Consists of the URL, base path, and API key for the IO Session Manager Internal service.
 */
export const IoSmIntConfigSchema = z.object({
  IO_SM_INT_API_URL: HttpUrlCodec, // TODO: rename to IO_SM_INT_API_URL_ORIGIN (since that is what we currently expect)
  IO_SM_INT_API_BASE_PATH: NonEmptyStringSchema,
  IO_SM_INT_API_KEY: NonEmptyStringSchema,
});
